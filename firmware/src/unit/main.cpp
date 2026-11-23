// Unidad del usuario — Wemos D1 R32 (ESP32) + SX1278 Ra-01 + BLE.
// Recibe telemetría LoRa del collar vinculado, descarta lo inválido/duplicado y
// la expone a la app Ovenbird Smart según el perfil BLE v1. Traduce COMMAND BLE
// a comandos LoRa (con cola y ventana RX para collares en modo ahorro) y
// devuelve COMMAND_ACK.
#include <Arduino.h>
#include <ble_codec.h>
#include <esp_task_wdt.h>
#include <frame.h>
#include <unit_logic.h>

#include "ble_gateway.h"
#include "config.h"
#include "log.h"

#if RADIO_LORA
#include <RadioLoRa.h>
static RadioLoRa radio(UNIT_PIN_LORA_SS, UNIT_PIN_LORA_RST, UNIT_PIN_LORA_DIO0);
#else
#include <RadioSim.h>
static RadioSim radio(Serial);
#endif

using namespace pet;

static BleGateway& bleGw = createBleGateway();
static SeqDeduplicator dedup;
static OnlineTracker online;
static UnitCommandQueue cmdQueue;

static uint8_t frameBuf[kMaxFrameLen];
static uint8_t nextLoraCmdId = 1;
static uint16_t bleSeq = 0;           // contador propio hacia Ovenbird (§4.4)
static bool haveTelemetry = false;
static Telemetry lastTel;
static uint32_t lastTelMs = 0;
static uint32_t telemetryCount = 0;
static bool collarContinuousRx = false;  // hasta conocerlo, esperar a la ventana
static bool lastOnline = false;
static uint32_t lastStatusMs = 0;
static uint16_t uiInterval = DEFAULT_INTERVAL_S;  // para el botón de modo

// Contadores de diagnóstico (sin datos sensibles)
static uint32_t rxInvalid = 0, rxDuplicate = 0;

// ---------------------------------------------------------------- BLE out -----
static void publishStatus(uint32_t now) {
  ble::Status s;
  s.battery_pct = haveTelemetry && lastTel.battery <= 100 ? lastTel.battery : 255;
  const int rssi = radio.lastRssi();
  s.link_rssi_dbm = (int8_t)(rssi < -128 ? -128 : (rssi > 127 ? 127 : rssi));
  s.link_snr_db = radio.lastSnr();
  s.collar_online = online.online(now);
  s.seq = bleSeq++;
  if (!haveTelemetry || lastTel.fix_age == kUnknownFixAge) {
    s.age_s = 0xFFFF;
  } else {
    const uint32_t age = lastTel.fix_age + (now - lastTelMs) / 1000UL;
    s.age_s = age > 0xFFFF ? 0xFFFF : (uint16_t)age;
  }
  uint8_t out[ble::kStatusLen];
  ble::encodeStatus(s, out);
  bleGw.publishStatus(out);
  lastStatusMs = now;
  lastOnline = s.collar_online;
}

static void publishLocation(const Telemetry& t) {
  ble::Location l;
  l.fix = ble::loraFixToBle(t.fix());
  l.lat_e7 = ble::e6ToE7(t.lat_e6);
  l.lon_e7 = ble::e6ToE7(t.lon_e6);
  l.hdop_x100 = t.has_gps_quality ? t.hdop_x100 : 0xFFFF;
  l.ts = 0;  // la trama LoRa v1 no trae hora; 0 = desconocido según el perfil
  uint8_t out[ble::kLocationLen];
  ble::encodeLocation(l, out);
  bleGw.publishLocation(out);
}

static void sendBleAck(uint16_t bleCmdId, uint8_t result) {
  if (bleCmdId == UnitCommandQueue::kInternalId) return;
  ble::Ack a = {bleCmdId, result};
  uint8_t out[ble::kAckLen];
  ble::encodeAck(a, out);
  bleGw.publishAck(out);
}

// ---------------------------------------------------------------- LoRa in -----
static void onTelemetry(const Telemetry& t, uint32_t now) {
  if (!dedup.accept(t.seq, t.flags & kFlagReinicio)) {
    ++rxDuplicate;
    LOG_BEGIN(); LOG(F("tel duplicada seq=")); LOGLN(t.seq);
    return;
  }
  lastTel = t;
  haveTelemetry = true;
  lastTelMs = now;
  ++telemetryCount;
  collarContinuousRx = t.flags & kFlagEscuchaContinua;
  online.setPowerSaveHint(t.flags & kFlagModoAhorro);
  if (t.has_power_profile) online.setKnownInterval(t.power_interval_s);
  if (t.has_fw) {
    char fw[16];
    snprintf(fw, sizeof(fw), "%u.%u.%u", t.fw[0], t.fw[1], t.fw[2]);
    bleGw.setFwVersion(fw);
  }
  LOG_BEGIN(); LOG(F("tel seq=")); LOG(t.seq); LOG(F(" fix=")); LOG(t.fix());
  LOG(F(" bat=")); LOG(t.battery); LOG(F(" rssi=")); LOG(radio.lastRssi());
  LOG(F(" ahorro=")); LOGLN((t.flags & kFlagModoAhorro) ? 1 : 0);
  publishLocation(t);
  publishStatus(now);
}

static void onAck(const Ack& a) {
  uint16_t bleId;
  uint8_t result;
  Command acked;
  if (!cmdQueue.onAck(a, bleId, result, &acked)) {
    LOG_BEGIN(); LOG(F("ack sin comando pendiente id=")); LOGLN(a.cmd_id);
    return;
  }
  if (acked.code == kCmdSetInterval && result == kAckOk) {
    uiInterval = getU16BE(acked.params);
    online.setKnownInterval(uiInterval);
  }
  LOG_BEGIN(); LOG(F("ack id=")); LOG(a.cmd_id); LOG(F(" result=")); LOGLN(result);
  sendBleAck(bleId, loraResultToBle(result));
}

static void pollRadio(uint32_t now) {
  const uint8_t n = radio.poll(frameBuf, sizeof(frameBuf));
  if (!n) return;
  Frame f;
  const DecodeStatus st = decodeFrame(frameBuf, n, PAIRED_DEV_ID, f);
  if (st != kDecodeOk) {
    ++rxInvalid;
    LOG_BEGIN(); LOG(F("rx descartada ")); LOGLN(decodeStatusName(st));
    return;
  }
  online.onValidFrame(now);
  if (f.type == kTypeTelemetry) onTelemetry(f.telemetry, now);
  else if (f.type == kTypeAck) onAck(f.ack);
  // TYPE 0x02 (comando) no se espera en la unidad: se ignora.
}

// ---------------------------------------------------------------- Comandos ----
static bool enqueueLora(const Command& c, uint16_t bleId, uint32_t now) {
  if (!cmdQueue.enqueue(c, bleId, now)) {
    sendBleAck(bleId, ble::kAckBusy);
    return false;
  }
  return true;
}

static void handleBleCommands(uint32_t now) {
  ble::Command bc;
  while (bleGw.pollCommand(bc)) {
    Command lc;
    if (!bleToLoraCommand(bc, nextLoraCmdId, lc)) {
      sendBleAck(bc.cmd_id, ble::kAckUnsupported);
      continue;
    }
    if (enqueueLora(lc, bc.cmd_id, now)) {
      ++nextLoraCmdId;
      LOG_BEGIN(); LOG(F("ble cmd op=")); LOG(bc.opcode); LOG(F(" arg=")); LOGLN(bc.arg);
    }
  }
}

static void pumpQueue(uint32_t now) {
  const Command* c = cmdQueue.nextToSend(now, collarContinuousRx, lastTelMs, telemetryCount);
  if (c) {
    const size_t n = encodeCommand(frameBuf, sizeof(frameBuf), PAIRED_DEV_ID, *c);
    if (n) radio.send(frameBuf, (uint8_t)n);
    LOG_FRAME_END();
    LOG_BEGIN(); LOG(F("tx cmd id=")); LOG(c->cmd_id); LOG(F(" code=")); LOGLN(c->code);
  }
  uint16_t bleId;
  while (cmdQueue.popExpired(now, collarContinuousRx, bleId)) {
    LOG_BEGIN(); LOGLN(F("comando sin respuesta del collar"));
    sendBleAck(bleId, ble::kAckNoResponse);
  }
}

// ---------------------------------------------------------------- Botones -----
static void handleButtons() {
  static uint32_t lastPressMs = 0;
  const uint32_t now = millis();
  if (now - lastPressMs < 300) return;  // antirrebote
  static uint16_t localId = 0xF000;     // IDs "BLE" locales para la demo
  ble::Command c;
  if (digitalRead(UNIT_PIN_BTN_FIND) == LOW) {
    c = {localId++, ble::kOpFindMe, 10};
    bleInject(c);
    lastPressMs = now;
  } else if (digitalRead(UNIT_PIN_BTN_MODE) == LOW) {
    const uint16_t target = uiInterval >= 100 ? 15 : 150;  // alterna normal/ahorro
    c = {localId++, ble::kOpSetInterval, target};
    bleInject(c);
    lastPressMs = now;
  }
}

static void updateLed(uint32_t now) {
  // Encendido fijo = collar online; parpadeo lento = offline.
  digitalWrite(UNIT_PIN_LED, online.online(now) ? HIGH : ((now / 1000) % 2));
}

// ---------------------------------------------------------------- Setup/loop --
void setup() {
  Serial.begin(115200);
  pinMode(UNIT_PIN_LED, OUTPUT);
  pinMode(UNIT_PIN_BUZZER, OUTPUT);
  pinMode(UNIT_PIN_BTN_FIND, INPUT_PULLUP);
  pinMode(UNIT_PIN_BTN_MODE, INPUT_PULLUP);
#if !RADIO_LORA
  radio.setLineHandler(bleConsoleLine);
#endif
  LOG_BEGIN(); LOG(F("unidad vinculada a DEV_ID=0x")); LOGHEX((uint16_t)PAIRED_DEV_ID); LOGLN("");
  while (!radio.begin()) {
    LOG_BEGIN(); LOGLN(F("ERROR radio; reintento en 2 s"));
    delay(2000);
  }
  bleGw.begin("?");
  esp_task_wdt_init(10, true);  // Estabilidad: reinicio si el loop se cuelga
  esp_task_wdt_add(nullptr);

  // §3.5: al arrancar la unidad pide telemetría inmediata (incluye FW_VERSION).
  Command req;
  memset(&req, 0, sizeof(req));
  req.cmd_id = nextLoraCmdId++;
  req.code = kCmdRequestTelemetry;
  cmdQueue.enqueue(req, UnitCommandQueue::kInternalId, millis());
  publishStatus(millis());
}

void loop() {
  esp_task_wdt_reset();
  const uint32_t now = millis();
  pollRadio(now);
  handleButtons();
  handleBleCommands(now);
  pumpQueue(now);
  if (now - lastStatusMs >= STATUS_REFRESH_MS || online.online(now) != lastOnline) {
    publishStatus(now);
  }
  updateLed(now);
  delay(1);
}
