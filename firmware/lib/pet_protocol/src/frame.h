// Interfaz 1 — Trama binaria Collar <-> Unidad (v1).
// Fuente de verdad: docs/01-acuerdo-interoperabilidad.md (Parte I).
// Big-endian en todos los campos multibyte. Sin memoria dinámica (apto AVR).
#pragma once
#include <stddef.h>
#include <stdint.h>

namespace pet {

// ---- Constantes de trama ---------------------------------------------------
const uint8_t kSync0 = 0xAA;
const uint8_t kSync1 = 0x55;
const uint8_t kVersion = 0x01;
const uint8_t kMinFrameLen = 12;
const uint8_t kMaxFrameLen = 64;
const uint8_t kHeaderLen = 7;          // SYNC(2) VER TYPE LEN DEV_ID(2)
const uint8_t kTelemetryBaseLen = 23;  // sin TLVs
const uint8_t kAckLen = 12;
const uint8_t kMaxCmdParams = kMaxFrameLen - 12;

enum FrameType : uint8_t {
  kTypeTelemetry = 0x01,
  kTypeCommand = 0x02,
  kTypeAck = 0x03,
};

enum CmdCode : uint8_t {
  kCmdSetInterval = 0x01,     // PLEN 2, u16 seg (5..3600)
  kCmdFindMe = 0x02,          // PLEN 1, u8 seg (0..60)
  kCmdRequestTelemetry = 0x03 // PLEN 0
};

enum AckResult : uint8_t {
  kAckOk = 0x00,
  kAckUnsupported = 0x01,
  kAckInvalidParam = 0x02,
  kAckFailed = 0x03,
};

// FLAGS de telemetría
const uint8_t kFlagFixMask = 0x03;          // bits 0-1: 0 none, 1 2D, 2 3D
const uint8_t kFlagEscuchaContinua = 0x04;  // bit 2
const uint8_t kFlagModoAhorro = 0x08;       // bit 3
const uint8_t kFlagReinicio = 0x10;         // bit 4

// TLVs comunes
const uint8_t kTlvFwVersion = 0x01;   // L=3 major,minor,patch
const uint8_t kTlvGpsQuality = 0x20;  // L=3 sats:u8, hdop_x100:u16
// Rango propio del Grupo 1: 0x10..0x1F (los demás grupos lo ignoran).
const uint8_t kTlvG1PowerProfile = 0x10;  // L=3 modo:u8, interval_s:u16

const uint16_t kUnknownFixAge = 0xFFFF;
const uint8_t kUnknownBattery = 0xFF;

// ---- Modelos ---------------------------------------------------------------
struct Telemetry {
  uint16_t seq;
  uint8_t flags;
  int32_t lat_e6;
  int32_t lon_e6;
  uint8_t battery;   // 0..100, 0xFF desconocida
  uint16_t fix_age;  // seg, 0xFFFF nunca
  // TLVs opcionales
  bool has_fw;
  uint8_t fw[3];
  bool has_gps_quality;
  uint8_t sats;
  uint16_t hdop_x100;
  bool has_power_profile;   // TLV 0x10 (Grupo 1)
  uint8_t power_mode;       // 0 normal, 1 ahorro
  uint16_t power_interval_s;

  uint8_t fix() const { return flags & kFlagFixMask; }
};

struct Command {
  uint8_t cmd_id;
  uint8_t code;
  uint8_t plen;
  uint8_t params[kMaxCmdParams];
};

struct Ack {
  uint8_t cmd_id;
  uint8_t code;
  uint8_t result;
};

struct Frame {
  uint8_t type;
  uint16_t dev_id;
  Telemetry telemetry;  // válido si type == kTypeTelemetry
  Command command;      // válido si type == kTypeCommand
  Ack ack;              // válido si type == kTypeAck
};

enum DecodeStatus : uint8_t {
  kDecodeOk = 0,
  kDecodeBadSync,
  kDecodeBadVersion,
  kDecodeBadLength,
  kDecodeBadCrc,
  kDecodeUnknownType,
  kDecodeWrongDevice,
  kDecodeBadBody,
};

const char* decodeStatusName(DecodeStatus s);

// ---- Helpers big-endian ----------------------------------------------------
inline void putU16BE(uint8_t* p, uint16_t v) { p[0] = v >> 8; p[1] = v & 0xFF; }
inline uint16_t getU16BE(const uint8_t* p) { return (uint16_t)((p[0] << 8) | p[1]); }
inline void putI32BE(uint8_t* p, int32_t v) {
  uint32_t u = (uint32_t)v;
  p[0] = u >> 24; p[1] = (u >> 16) & 0xFF; p[2] = (u >> 8) & 0xFF; p[3] = u & 0xFF;
}
inline int32_t getI32BE(const uint8_t* p) {
  return (int32_t)(((uint32_t)p[0] << 24) | ((uint32_t)p[1] << 16) |
                   ((uint32_t)p[2] << 8) | (uint32_t)p[3]);
}

// ---- Codificación (devuelven largo escrito, 0 si no entra/params inválidos) ----
size_t encodeTelemetry(uint8_t* out, size_t cap, uint16_t dev_id, const Telemetry& t);
size_t encodeCommand(uint8_t* out, size_t cap, uint16_t dev_id, const Command& c);
size_t encodeAck(uint8_t* out, size_t cap, uint16_t dev_id, const Ack& a);

// ---- Decodificación con el orden estricto de validación (§2) ----------------
// expected_dev_id == 0 => no se valida DEV_ID (paso 6), útil para sniffers.
DecodeStatus decodeFrame(const uint8_t* buf, size_t len, uint16_t expected_dev_id, Frame& out);

// Inicializa una Telemetry sin TLVs.
void clearTelemetry(Telemetry& t);

}  // namespace pet
