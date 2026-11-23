#include "frame.h"

#include <string.h>

#include "crc16.h"

namespace pet {

namespace {

size_t writeHeader(uint8_t* out, uint8_t type, uint8_t len, uint16_t dev_id) {
  out[0] = kSync0;
  out[1] = kSync1;
  out[2] = kVersion;
  out[3] = type;
  out[4] = len;
  putU16BE(out + 5, dev_id);
  return kHeaderLen;
}

void writeCrc(uint8_t* out, uint8_t len) {
  uint16_t crc = crc16_ccitt_false(out + 2, len - 4);
  putU16BE(out + len - 2, crc);
}

bool decodeTelemetryBody(const uint8_t* b, uint8_t len, Telemetry& t) {
  if (len < kTelemetryBaseLen) return false;
  clearTelemetry(t);
  t.seq = getU16BE(b + 7);
  t.flags = b[9];
  t.lat_e6 = getI32BE(b + 10);
  t.lon_e6 = getI32BE(b + 14);
  t.battery = b[18];
  t.fix_age = getU16BE(b + 19);

  const uint8_t end = len - 2;  // TLVs estrictamente dentro de LEN-2
  uint8_t pos = 21;
  while (pos < end) {
    if (pos + 2 > end) return false;
    const uint8_t type = b[pos];
    const uint8_t l = b[pos + 1];
    const uint8_t* v = b + pos + 2;
    if (pos + 2 + l > end) return false;
    if (type == kTlvFwVersion && l == 3) {
      t.has_fw = true;
      memcpy(t.fw, v, 3);
    } else if (type == kTlvGpsQuality && l == 3) {
      t.has_gps_quality = true;
      t.sats = v[0];
      t.hdop_x100 = getU16BE(v + 1);
    } else if (type == kTlvG1PowerProfile && l == 3) {
      t.has_power_profile = true;
      t.power_mode = v[0];
      t.power_interval_s = getU16BE(v + 1);
    }
    // TLV desconocido (o largo inesperado): se saltan L bytes.
    pos += 2 + l;
  }
  return true;
}

}  // namespace

void clearTelemetry(Telemetry& t) { memset(&t, 0, sizeof(t)); }

const char* decodeStatusName(DecodeStatus s) {
  switch (s) {
    case kDecodeOk: return "OK";
    case kDecodeBadSync: return "BAD_SYNC";
    case kDecodeBadVersion: return "BAD_VERSION";
    case kDecodeBadLength: return "BAD_LENGTH";
    case kDecodeBadCrc: return "BAD_CRC";
    case kDecodeUnknownType: return "UNKNOWN_TYPE";
    case kDecodeWrongDevice: return "WRONG_DEVICE";
    case kDecodeBadBody: return "BAD_BODY";
  }
  return "?";
}

size_t encodeTelemetry(uint8_t* out, size_t cap, uint16_t dev_id, const Telemetry& t) {
  size_t len = kTelemetryBaseLen;
  if (t.has_fw) len += 5;
  if (t.has_gps_quality) len += 5;
  if (t.has_power_profile) len += 5;
  if (len > kMaxFrameLen || len > cap) return 0;

  writeHeader(out, kTypeTelemetry, (uint8_t)len, dev_id);
  putU16BE(out + 7, t.seq);
  out[9] = t.flags & 0x1F;  // bits 5-7 reservados en 0
  putI32BE(out + 10, t.lat_e6);
  putI32BE(out + 14, t.lon_e6);
  out[18] = t.battery;
  putU16BE(out + 19, t.fix_age);
  size_t pos = 21;
  if (t.has_fw) {
    out[pos++] = kTlvFwVersion; out[pos++] = 3;
    memcpy(out + pos, t.fw, 3); pos += 3;
  }
  if (t.has_gps_quality) {
    out[pos++] = kTlvGpsQuality; out[pos++] = 3;
    out[pos++] = t.sats; putU16BE(out + pos, t.hdop_x100); pos += 2;
  }
  if (t.has_power_profile) {
    out[pos++] = kTlvG1PowerProfile; out[pos++] = 3;
    out[pos++] = t.power_mode; putU16BE(out + pos, t.power_interval_s); pos += 2;
  }
  writeCrc(out, (uint8_t)len);
  return len;
}

size_t encodeCommand(uint8_t* out, size_t cap, uint16_t dev_id, const Command& c) {
  if (c.plen > kMaxCmdParams) return 0;
  const size_t len = 12 + c.plen;
  if (len > cap) return 0;
  writeHeader(out, kTypeCommand, (uint8_t)len, dev_id);
  out[7] = c.cmd_id;
  out[8] = c.code;
  out[9] = c.plen;
  memcpy(out + 10, c.params, c.plen);
  writeCrc(out, (uint8_t)len);
  return len;
}

size_t encodeAck(uint8_t* out, size_t cap, uint16_t dev_id, const Ack& a) {
  if (cap < kAckLen) return 0;
  writeHeader(out, kTypeAck, kAckLen, dev_id);
  out[7] = a.cmd_id;
  out[8] = a.code;
  out[9] = a.result;
  writeCrc(out, kAckLen);
  return kAckLen;
}

DecodeStatus decodeFrame(const uint8_t* b, size_t len, uint16_t expected_dev_id, Frame& out) {
  // 1. SYNC
  if (len < 2 || b[0] != kSync0 || b[1] != kSync1) return kDecodeBadSync;
  // 2. VER
  if (len < 3 || b[2] != kVersion) return kDecodeBadVersion;
  // 3. LEN
  if (len < kMinFrameLen || len > kMaxFrameLen || b[4] != len) return kDecodeBadLength;
  const uint8_t flen = b[4];
  // 4. CRC sobre [2 .. LEN-3]
  if (crc16_ccitt_false(b + 2, flen - 4) != getU16BE(b + flen - 2)) return kDecodeBadCrc;
  // 5. TYPE
  const uint8_t type = b[3];
  if (type != kTypeTelemetry && type != kTypeCommand && type != kTypeAck) return kDecodeUnknownType;
  // 6. DEV_ID
  const uint16_t dev = getU16BE(b + 5);
  if (expected_dev_id != 0 && dev != expected_dev_id) return kDecodeWrongDevice;
  // 7. Cuerpo
  out.type = type;
  out.dev_id = dev;
  switch (type) {
    case kTypeTelemetry:
      if (!decodeTelemetryBody(b, flen, out.telemetry)) return kDecodeBadBody;
      break;
    case kTypeCommand: {
      const uint8_t plen = b[9];
      if (flen != 12 + plen) return kDecodeBadBody;
      out.command.cmd_id = b[7];
      out.command.code = b[8];
      out.command.plen = plen;
      memcpy(out.command.params, b + 10, plen);
      break;
    }
    case kTypeAck:
      if (flen != kAckLen) return kDecodeBadBody;
      out.ack.cmd_id = b[7];
      out.ack.code = b[8];
      out.ack.result = b[9];
      break;
  }
  return kDecodeOk;
}

}  // namespace pet
