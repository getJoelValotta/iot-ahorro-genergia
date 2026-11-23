// Perfil BLE v1 de Ovenbird (Unidad <-> app Ovenbird Smart). LITTLE-endian.
// Fuente: docs/02-ovenbird-plataforma.md + docs/vendor/ble-test-vectors.json
// ¡Ojo! Difiere de la trama LoRa: lat/lon en grados x 1e7 (LoRa usa x 1e6) y
// los opcodes BLE (1=find_me, 2=set_interval) NO coinciden con CMD_CODE LoRa.
#pragma once
#include <stddef.h>
#include <stdint.h>

namespace pet {
namespace ble {

// UUIDs: 6f76656e-6269-7264-XXXX-000000000000
#define OB_UUID(x) "6f76656e-6269-7264-" x "-000000000000"
#define OB_UUID_SERVICE OB_UUID("0001")
#define OB_UUID_PRODUCT OB_UUID("0002")   // read, UTF-8 "ob.lora.unit"
#define OB_UUID_UID OB_UUID("0003")       // read, 6 bytes MAC en orden de impresión
#define OB_UUID_PROTO OB_UUID("0004")     // read, u8 = 1
#define OB_UUID_FW OB_UUID("0005")        // read, UTF-8 <= 16 bytes
#define OB_UUID_LOCATION OB_UUID("0010")  // read+notify, 16 bytes
#define OB_UUID_STATUS OB_UUID("0011")    // read+notify, 8 bytes
#define OB_UUID_COMMAND OB_UUID("0020")   // write, 5 bytes
#define OB_UUID_ACK OB_UUID("0021")       // notify, 3 bytes

static const char kProductId[] = "ob.lora.unit";
const uint8_t kProtoVersion = 1;

const size_t kLocationLen = 16;
const size_t kStatusLen = 8;
const size_t kCommandLen = 5;
const size_t kAckLen = 3;

enum Opcode : uint8_t { kOpFindMe = 1, kOpSetInterval = 2 };
enum AckResult : uint8_t { kAckOk = 0, kAckBusy = 1, kAckUnsupported = 2, kAckNoResponse = 3 };

struct Location {
  int32_t lat_e7;
  int32_t lon_e7;
  uint16_t hdop_x100;  // 0xFFFF desconocido
  uint8_t fix;         // 0 none, 2 2D, 3 3D
  uint32_t ts;         // Unix s UTC, 0 desconocido
};

struct Status {
  uint8_t battery_pct;  // 255 desconocido
  int8_t link_rssi_dbm;
  int8_t link_snr_db;
  bool collar_online;   // flags bit 0
  uint16_t seq;
  uint16_t age_s;       // satura en 65535
};

struct Command {
  uint16_t cmd_id;
  uint8_t opcode;
  uint16_t arg;
};

struct Ack {
  uint16_t cmd_id;
  uint8_t result;
};

void encodeLocation(const Location& l, uint8_t out[kLocationLen]);
void encodeStatus(const Status& s, uint8_t out[kStatusLen]);
void encodeAck(const Ack& a, uint8_t out[kAckLen]);
bool decodeCommand(const uint8_t* in, size_t len, Command& out);

// Para tests / herramientas.
bool decodeLocation(const uint8_t* in, size_t len, Location& out);
bool decodeStatus(const uint8_t* in, size_t len, Status& out);
void encodeCommand(const Command& c, uint8_t out[kCommandLen]);

// Conversiones LoRa -> BLE
inline int32_t e6ToE7(int32_t v) { return v * 10; }  // |180e7| < 2^31, no desborda
// FIX LoRa (0 none, 1 2D, 2 3D) -> BLE (0, 2, 3)
inline uint8_t loraFixToBle(uint8_t f) { return f == 1 ? 2 : (f == 2 ? 3 : 0); }

}  // namespace ble
}  // namespace pet
