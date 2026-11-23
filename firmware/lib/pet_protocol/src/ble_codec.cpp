#include "ble_codec.h"

namespace pet {
namespace ble {

namespace {
inline void putU16LE(uint8_t* p, uint16_t v) { p[0] = v & 0xFF; p[1] = v >> 8; }
inline void putU32LE(uint8_t* p, uint32_t v) {
  p[0] = v & 0xFF; p[1] = (v >> 8) & 0xFF; p[2] = (v >> 16) & 0xFF; p[3] = v >> 24;
}
inline uint16_t getU16LE(const uint8_t* p) { return (uint16_t)(p[0] | (p[1] << 8)); }
inline uint32_t getU32LE(const uint8_t* p) {
  return (uint32_t)p[0] | ((uint32_t)p[1] << 8) | ((uint32_t)p[2] << 16) | ((uint32_t)p[3] << 24);
}
}  // namespace

void encodeLocation(const Location& l, uint8_t out[kLocationLen]) {
  const bool fix = l.fix != 0;
  putU32LE(out + 0, (uint32_t)(fix ? l.lat_e7 : 0));
  putU32LE(out + 4, (uint32_t)(fix ? l.lon_e7 : 0));
  putU16LE(out + 8, l.hdop_x100);
  out[10] = l.fix;
  out[11] = 0;  // reservado
  putU32LE(out + 12, l.ts);
}

void encodeStatus(const Status& s, uint8_t out[kStatusLen]) {
  out[0] = s.battery_pct;
  out[1] = (uint8_t)s.link_rssi_dbm;
  out[2] = (uint8_t)s.link_snr_db;
  out[3] = s.collar_online ? 0x01 : 0x00;
  putU16LE(out + 4, s.seq);
  putU16LE(out + 6, s.age_s);
}

void encodeAck(const Ack& a, uint8_t out[kAckLen]) {
  putU16LE(out, a.cmd_id);
  out[2] = a.result;
}

void encodeCommand(const Command& c, uint8_t out[kCommandLen]) {
  putU16LE(out, c.cmd_id);
  out[2] = c.opcode;
  putU16LE(out + 3, c.arg);
}

bool decodeCommand(const uint8_t* in, size_t len, Command& out) {
  if (len != kCommandLen) return false;
  out.cmd_id = getU16LE(in);
  out.opcode = in[2];
  out.arg = getU16LE(in + 3);
  return true;
}

bool decodeLocation(const uint8_t* in, size_t len, Location& out) {
  if (len != kLocationLen) return false;
  out.lat_e7 = (int32_t)getU32LE(in);
  out.lon_e7 = (int32_t)getU32LE(in + 4);
  out.hdop_x100 = getU16LE(in + 8);
  out.fix = in[10];
  out.ts = getU32LE(in + 12);
  return true;
}

bool decodeStatus(const uint8_t* in, size_t len, Status& out) {
  if (len != kStatusLen) return false;
  out.battery_pct = in[0];
  out.link_rssi_dbm = (int8_t)in[1];
  out.link_snr_db = (int8_t)in[2];
  out.collar_online = (in[3] & 0x01) != 0;
  out.seq = getU16LE(in + 4);
  out.age_s = getU16LE(in + 6);
  return true;
}

}  // namespace ble
}  // namespace pet
