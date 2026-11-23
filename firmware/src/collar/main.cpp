// Collar — Arduino Nano v3 (+ SX1278 Ra-01 + NEO-6M).
// Variante Grupo 1 (power-saving): con SET_INTERVAL >= 100 s entra en modo ahorro:
//   - FLAGS: MODO_AHORRO=1, ESCUCHA_CONTINUA=0
//   - radio dormida salvo la ventana RX de 500 ms post-TX (+500 ms por comando)
//   - GPS apagado entre reportes (se enciende GPS_WARMUP_MS antes de cada TX)
//   - MCU en sleep IDLE entre eventos
// En modo normal (< 100 s) escucha continua y GPS siempre encendido.
#include <Arduino.h>
#include <TinyGPS++.h>
#include <avr/sleep.h>
#include <avr/wdt.h>
#include <collar_logic.h>
#include <frame.h>
#include <nmea_sim.h>

#include "config.h"
#include "log.h"
#include "route_data.h"

#if RADIO_LORA
#include <RadioLoRa.h>
static RadioLoRa radio(COLLAR_PIN_LORA_SS, COLLAR_PIN_LORA_RST, COLLAR_PIN_LORA_DIO0);
#else
#include <RadioSim.h>
static RadioSim radio(Serial);
#endif

#if !GPS_SIM
#include <SoftwareSerial.h>
static SoftwareSerial gpsSerial(COLLAR_PIN_GPS_RX, COLLAR_PIN_GPS_TX);
#endif

using namespace pet;

static TinyGPSPlus gps;
static CollarCommandHandler cmdHandler;
static FindMeTimer findMe;
static PowerProfile profile;

static uint16_t seq = 0;
static uint8_t rebootFramesLeft = REBOOT_FRAMES;
static bool sendFwNext = true;
static uint32_t lastTxMs = 0;
static uint32_t rxWindowEndMs = 0;
static bool gpsPowered = true;
static uint8_t frameBuf[kMaxFrameLen];

// ---------------------------------------------------------------- GPS ---------
static void setGpsPower(bool on) {
  if (gpsPowered == on) return;
  gpsPowered = on;
  digitalWrite(COLLAR_PIN_GPS_EN, on ? HIGH : LOW);
  LOG_BEGIN(); LOG(F("gps ")); LOGLN(on ? F("ON") : F("OFF"));
}

#if GPS_SIM
// Genera NMEA desde la ruta y lo procesa con TinyGPS++ (misma librería que con el NEO-6M).
static void gpsSimTick(uint32_t now) {
  static uint32_t lastNmeaMs = 0;
  if (!gpsPowered || now - lastNmeaMs < 1000UL) return;
  lastNmeaMs = now;
  const uint32_t pos = now % (kRouteSegmentMs * kRouteLen);
  const uint8_t i = pos / kRouteSegmentMs;
  const uint8_t j = (i + 1) % kRouteLen;
  const uint16_t t = (uint16_t)(((pos % kRouteSegmentMs) * 1000UL) / kRouteSegmentMs);
  NmeaFix f;
  f.lat_e6 = lerpE6((int32_t)pgm_read_dword(&kRoute[i][0]), (int32_t)pgm_read_dword(&kRoute[j][0]), t);
  f.lon_e6 = lerpE6((int32_t)pgm_read_dword(&kRoute[i][1]), (int32_t)pgm_read_dword(&kRoute[j][1]), t);
  const uint32_t secs = now / 1000UL;
  f.hour = (secs / 3600) % 24; f.minute = (secs / 60) % 60; f.second = secs % 60;
  f.day = 23; f.month = 11; f.year = 26;
  f.sats = 7 + (secs % 3);
  f.hdop_x100 = 90 + (secs % 40);
  f.valid = true;
  char line[90];
  size_t n = buildGPGGA(f, line, sizeof(line));
  for (size_t k = 0; k < n; ++k) gps.encode(line[k]);
  n = buildGPRMC(f, line, sizeof(line));
  for (size_t k = 0; k < n; ++k) gps.encode(line[k]);
}
#else
static void gpsSimTick(uint32_t) {
  while (gpsPowered && gpsSerial.available()) gps.encode(gpsSerial.read());
}
#endif

// ---------------------------------------------------------------- Batería ----
static uint8_t readBatteryPct() {
  // Sim: potenciómetro en A0. Real: divisor resistivo de la LiPo (3.3 V..4.2 V).
  const int raw = analogRead(COLLAR_PIN_BATTERY);
  if (raw < 0) return kUnknownBattery;
  return (uint8_t)map(raw, 0, 1023, 0, 100);
}

// ---------------------------------------------------------------- TX ----------
static void sendTelemetry(uint32_t now) {
  Telemetry t;
  clearTelemetry(t);
  t.seq = seq++;
  uint8_t fix = 0;
  if (gps.location.isValid() && gps.location.age() < 60000UL) {
    fix = (gps.satellites.isValid() && gps.satellites.value() >= 4) ? 2 : 1;
  }
  t.flags = fix;
  if (profile.continuous_rx) t.flags |= kFlagEscuchaContinua;
  if (profile.power_save) t.flags |= kFlagModoAhorro;
  if (rebootFramesLeft > 0) { t.flags |= kFlagReinicio; --rebootFramesLeft; sendFwNext = true; }
  if (fix) {
    t.lat_e6 = (int32_t)(gps.location.lat() * 1e6);
    t.lon_e6 = (int32_t)(gps.location.lng() * 1e6);
  }
  t.battery = readBatteryPct();
  if (gps.location.isValid()) {
    const uint32_t age_s = gps.location.age() / 1000UL;
    t.fix_age = age_s >= 0xFFFF ? kUnknownFixAge : (uint16_t)age_s;
  } else {
    t.fix_age = kUnknownFixAge;
  }
  if (sendFwNext) {
    t.has_fw = true;
    t.fw[0] = FW_MAJOR; t.fw[1] = FW_MINOR; t.fw[2] = FW_PATCH;
    sendFwNext = false;
  }
  if (gps.satellites.isValid() && gps.hdop.isValid()) {
    t.has_gps_quality = true;
    t.sats = (uint8_t)gps.satellites.value();
    t.hdop_x100 = (uint16_t)gps.hdop.value();
  }
  t.has_power_profile = true;  // TLV 0x10 (Grupo 1), los demás lo ignoran
  t.power_mode = profile.power_save ? 1 : 0;
  t.power_interval_s = profile.interval_s;

  const size_t n = encodeTelemetry(frameBuf, sizeof(frameBuf), DEV_ID, t);
  radio.wake();
  if (n && radio.send(frameBuf, (uint8_t)n)) {
    LOG_FRAME_END();
    LOG_BEGIN(); LOG(F("tx tel seq=")); LOG(t.seq); LOG(F(" fix=")); LOG(fix);
    LOG(F(" bat=")); LOG(t.battery); LOG(F(" ahorro=")); LOGLN(profile.power_save);
  }
  lastTxMs = now;
  if (!profile.continuous_rx) rxWindowEndMs = now + RX_WINDOW_MS;
}

static void applyProfile(uint16_t interval_s) {
  profile = profileForInterval(interval_s);
  LOG_BEGIN(); LOG(F("perfil intervalo=")); LOG(profile.interval_s);
  LOG(F("s ahorro=")); LOGLN(profile.power_save);
}

// ---------------------------------------------------------------- RX ----------
static void handleRadio(uint32_t now) {
  const bool listening = profile.continuous_rx || (int32_t)(rxWindowEndMs - now) > 0;
  if (!listening) {
    radio.sleep();
    return;
  }
  const uint8_t n = radio.poll(frameBuf, sizeof(frameBuf));
  if (!n) return;
  Frame f;
  const DecodeStatus st = decodeFrame(frameBuf, n, DEV_ID, f);
  if (st != kDecodeOk || f.type != kTypeCommand) {
    LOG_BEGIN(); LOG(F("rx descartada ")); LOGLN(decodeStatusName(st));
    return;
  }
  CommandEffects fx;
  const Ack ack = cmdHandler.handle(f.command, fx);
  rxWindowEndMs = now + RX_WINDOW_MS;  // extiende la ventana por cada comando
  const size_t an = encodeAck(frameBuf, sizeof(frameBuf), DEV_ID, ack);
  radio.send(frameBuf, (uint8_t)an);
  LOG_FRAME_END();
  LOG_BEGIN(); LOG(F("cmd id=")); LOG(ack.cmd_id); LOG(F(" code=")); LOG(ack.code);
  LOG(F(" -> ack ")); LOGLN(ack.result);

  if (fx.interval_changed) applyProfile(fx.interval_s);
  if (fx.find_me) findMe.start(fx.find_me_s, now);
  if (fx.telemetry_now) {
    sendFwNext = true;
    sendTelemetry(now);
  }
}

// ---------------------------------------------------------------- Avisos ------
static void updateAlerts(uint32_t now) {
  const bool on = findMe.active(now);
  static bool wasOn = false;
  if (on) {
    const bool phase = (now / 250UL) % 2;
    digitalWrite(COLLAR_PIN_LED, phase);
    if (phase) tone(COLLAR_PIN_BUZZER, 2000); else noTone(COLLAR_PIN_BUZZER);
  } else if (wasOn) {  // estado seguro: todo apagado al vencer
    noTone(COLLAR_PIN_BUZZER);
    digitalWrite(COLLAR_PIN_LED, LOW);
  }
  wasOn = on;
}

// ---------------------------------------------------------------- Setup/loop --
void setup() {
  wdt_disable();
  Serial.begin(115200);
  pinMode(COLLAR_PIN_BUZZER, OUTPUT);
  pinMode(COLLAR_PIN_LED, OUTPUT);
  pinMode(COLLAR_PIN_GPS_EN, OUTPUT);
  digitalWrite(COLLAR_PIN_GPS_EN, HIGH);
#if !GPS_SIM
  gpsSerial.begin(9600);
#endif
  randomSeed(analogRead(A1));
  applyProfile(DEFAULT_INTERVAL_S);
  LOG_BEGIN(); LOG(F("collar DEV_ID=0x")); LOGHEX((uint16_t)DEV_ID); LOGLN(F(" listo"));
  if (!radio.begin()) {
    LOG_BEGIN(); LOGLN(F("ERROR radio; reintento en 5 s"));
    delay(5000);
    wdt_enable(WDTO_15MS);  // reinicio limpio por watchdog (Recuperación)
    for (;;) {}
  }
  wdt_enable(WDTO_8S);  // Estabilidad: si el loop se cuelga, el collar se reinicia
  lastTxMs = millis() - (uint32_t)profile.interval_s * 1000UL;  // primera TX inmediata
}

void loop() {
  wdt_reset();
  const uint32_t now = millis();
  const uint32_t intervalMs = (uint32_t)profile.interval_s * 1000UL;
  const uint32_t sinceTx = now - lastTxMs;

  // GPS: siempre en modo normal; en ahorro solo durante el warm-up previo a la TX.
  setGpsPower(!profile.power_save || sinceTx + GPS_WARMUP_MS >= intervalMs);
  gpsSimTick(now);

  if (sinceTx >= intervalMs) sendTelemetry(now);

  handleRadio(now);
  updateAlerts(now);

  // Bajo consumo: IDLE mantiene timers/UART vivos (despierta con la interrupción de millis).
  if (profile.power_save && !findMe.active(now)) {
    set_sleep_mode(SLEEP_MODE_IDLE);
    sleep_mode();
  }
}
