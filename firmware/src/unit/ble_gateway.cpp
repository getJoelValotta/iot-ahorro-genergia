#include "ble_gateway.h"

#include <string.h>

#include "config.h"
#include "log.h"

using namespace pet;

void BleCommandInbox::push(const ble::Command& c) {
  portENTER_CRITICAL(&mux_);
  const uint8_t next = (head_ + 1) % kSize;
  if (next != tail_) {  // si está llena se descarta; la app reintenta
    q_[head_] = c;
    head_ = next;
  }
  portEXIT_CRITICAL(&mux_);
}

bool BleCommandInbox::pop(ble::Command& out) {
  bool ok = false;
  portENTER_CRITICAL(&mux_);
  if (tail_ != head_) {
    out = q_[tail_];
    tail_ = (tail_ + 1) % kSize;
    ok = true;
  }
  portEXIT_CRITICAL(&mux_);
  return ok;
}

static BleCommandInbox inbox;

void bleInject(const ble::Command& c) { inbox.push(c); }

#if ENABLE_BLE
// ============================================================================
// Perfil BLE v1 real (NimBLE-Arduino 1.4.x)
// ============================================================================
#include <NimBLEDevice.h>
#if __has_include(<esp_mac.h>)
#include <esp_mac.h>
#else
#include <esp_system.h>
#endif

namespace {

class BleOvenbird : public BleGateway, NimBLEServerCallbacks, NimBLECharacteristicCallbacks {
 public:
  void begin(const char* fw) override {
    uint8_t mac[6];
    esp_read_mac(mac, ESP_MAC_BT);  // DEVICE_UID: MAC en orden de impresión
    char name[8];
    snprintf(name, sizeof(name), "OB-%02X%02X", mac[4], mac[5]);
    NimBLEDevice::init(name);
    NimBLEDevice::setPower(ESP_PWR_LVL_P9);
    server_ = NimBLEDevice::createServer();
    server_->setCallbacks(this);
    NimBLEService* svc = server_->createService(OB_UUID_SERVICE);

    svc->createCharacteristic(OB_UUID_PRODUCT, NIMBLE_PROPERTY::READ)->setValue(ble::kProductId);
    svc->createCharacteristic(OB_UUID_UID, NIMBLE_PROPERTY::READ)->setValue(mac, 6);
    const uint8_t proto = ble::kProtoVersion;
    svc->createCharacteristic(OB_UUID_PROTO, NIMBLE_PROPERTY::READ)->setValue(&proto, 1);
    fw_ = svc->createCharacteristic(OB_UUID_FW, NIMBLE_PROPERTY::READ);
    fw_->setValue(fw);
    loc_ = svc->createCharacteristic(OB_UUID_LOCATION, NIMBLE_PROPERTY::READ | NIMBLE_PROPERTY::NOTIFY);
    status_ = svc->createCharacteristic(OB_UUID_STATUS, NIMBLE_PROPERTY::READ | NIMBLE_PROPERTY::NOTIFY);
    NimBLECharacteristic* cmd = svc->createCharacteristic(
        OB_UUID_COMMAND, NIMBLE_PROPERTY::WRITE | NIMBLE_PROPERTY::WRITE_NR);
    cmd->setCallbacks(this);
    ack_ = svc->createCharacteristic(OB_UUID_ACK, NIMBLE_PROPERTY::NOTIFY);
    svc->start();

    NimBLEAdvertising* adv = NimBLEDevice::getAdvertising();
    adv->addServiceUUID(OB_UUID_SERVICE);
    adv->setName(name);
    adv->setMinInterval(160);  // 100 ms (unidades de 0.625 ms)
    adv->setMaxInterval(800);  // 500 ms
    adv->start();
    LOG_BEGIN(); LOG(F("ble anunciando ")); LOGLN(name);
  }

  void setFwVersion(const char* fw) override { fw_->setValue(fw); }

  void publishLocation(const uint8_t (&v)[ble::kLocationLen]) override {
    loc_->setValue(v, sizeof(v));
    if (connected_) loc_->notify();
  }
  void publishStatus(const uint8_t (&v)[ble::kStatusLen]) override {
    status_->setValue(v, sizeof(v));
    if (connected_) status_->notify();
  }
  void publishAck(const uint8_t (&v)[ble::kAckLen]) override {
    ack_->setValue(v, sizeof(v));
    if (connected_) ack_->notify();
  }
  bool pollCommand(ble::Command& out) override { return inbox.pop(out); }
  bool connected() const override { return connected_; }

  // --- callbacks NimBLE ---
  void onConnect(NimBLEServer*) override {
    connected_ = true;  // un solo central: NimBLE deja de anunciar al conectar
  }
  void onDisconnect(NimBLEServer*) override {
    connected_ = false;
    NimBLEDevice::startAdvertising();
  }
  void onSubscribe(NimBLECharacteristic* c, ble_gap_conn_desc*, uint16_t subValue) override {
    if (subValue) c->notify();  // enviar de inmediato el último valor conocido
  }
  void onWrite(NimBLECharacteristic* c) override {
    ble::Command cmd;
    const std::string v = c->getValue();
    if (ble::decodeCommand((const uint8_t*)v.data(), v.size(), cmd)) inbox.push(cmd);
  }

 private:
  NimBLEServer* server_ = nullptr;
  NimBLECharacteristic *fw_ = nullptr, *loc_ = nullptr, *status_ = nullptr, *ack_ = nullptr;
  volatile bool connected_ = false;
};

}  // namespace

BleGateway& createBleGateway() {
  static BleOvenbird g;
  return g;
}

void bleConsoleLine(const char*) {}

#else
// ============================================================================
// Emulación por consola (Wokwi)
// ============================================================================
namespace {

class BleConsole : public BleGateway {
 public:
  void begin(const char* fw) override { setFwVersion(fw); }
  void setFwVersion(const char* fw) override {
    (void)fw;
    LOG_BEGIN(); LOG(F("BLE FW_VERSION ")); LOGLN(fw);
  }
  void publishLocation(const uint8_t (&v)[ble::kLocationLen]) override { dump("LOCATION", v, sizeof(v)); }
  void publishStatus(const uint8_t (&v)[ble::kStatusLen]) override { dump("STATUS", v, sizeof(v)); }
  void publishAck(const uint8_t (&v)[ble::kAckLen]) override { dump("COMMAND_ACK", v, sizeof(v)); }
  bool pollCommand(ble::Command& out) override { return inbox.pop(out); }
  bool connected() const override { return true; }

 private:
  static void dump(const char* name, const uint8_t* v, uint8_t n) {
    (void)name;
    LOG_BEGIN(); LOG(F("BLE ")); LOG(name); LOG(' ');
    logHexBytes(v, n);
    LOGLN("");
  }
};

int hexNibble(char c) {
  if (c >= '0' && c <= '9') return c - '0';
  if (c >= 'a' && c <= 'f') return c - 'a' + 10;
  if (c >= 'A' && c <= 'F') return c - 'A' + 10;
  return -1;
}

}  // namespace

BleGateway& createBleGateway() {
  static BleConsole g;
  return g;
}

// ">ble 0700010a00"  (5 bytes del COMMAND BLE en hex, little-endian)
void bleConsoleLine(const char* line) {
  if (strncmp(line, "ble ", 4) != 0) return;
  uint8_t bytes[ble::kCommandLen];
  uint8_t n = 0;
  for (const char* p = line + 4; *p && n < sizeof(bytes);) {
    if (*p == ' ') { ++p; continue; }
    const int hi = hexNibble(p[0]);
    const int lo = p[1] ? hexNibble(p[1]) : -1;
    if (hi < 0 || lo < 0) return;
    bytes[n++] = (uint8_t)((hi << 4) | lo);
    p += 2;
  }
  ble::Command cmd;
  if (ble::decodeCommand(bytes, n, cmd)) inbox.push(cmd);
  else { LOG_BEGIN(); LOGLN(F("BLE COMMAND invalido")); }
}
#endif
