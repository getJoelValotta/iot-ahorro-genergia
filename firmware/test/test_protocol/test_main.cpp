// Tests de la Interfaz 1 (trama LoRa) con los vectores verificados del acuerdo.
// Ejecutar: pio test -e native   (o: make -C firmware test)
#include <string.h>
#include <unity.h>

#include "crc16.h"
#include "frame.h"
#include "stream_parser.h"

using namespace pet;

void setUp() {}
void tearDown() {}

static const uint16_t DEV = 0x0401;  // DEV_ID usado por los vectores del acuerdo

static const uint8_t V_TEL_BASE[] = {0xAA, 0x55, 0x01, 0x01, 0x17, 0x04, 0x01, 0x00, 0x01, 0x06, 0xFD, 0xEF,
                                     0xFD, 0x36, 0xFC, 0x85, 0x2A, 0xE8, 0x55, 0x00, 0x02, 0xCD, 0x69};
static const uint8_t V_TEL_NOFIX[] = {0xAA, 0x55, 0x01, 0x01, 0x17, 0x04, 0x01, 0x00, 0x02, 0x04, 0x00, 0x00,
                                      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x54, 0xFF, 0xFF, 0xC7, 0xDD};
static const uint8_t V_TEL_REBOOT[] = {0xAA, 0x55, 0x01, 0x01, 0x1C, 0x04, 0x01, 0x00, 0x00, 0x16,
                                       0xFD, 0xEF, 0xFD, 0x36, 0xFC, 0x85, 0x2A, 0xE8, 0x64, 0x00,
                                       0x00, 0x01, 0x03, 0x01, 0x00, 0x00, 0x32, 0x6E};
static const uint8_t V_SET_INTERVAL_15[] = {0xAA, 0x55, 0x01, 0x02, 0x0E, 0x04, 0x01,
                                            0x01, 0x01, 0x02, 0x00, 0x0F, 0x11, 0x06};
static const uint8_t V_FIND_ME_10[] = {0xAA, 0x55, 0x01, 0x02, 0x0D, 0x04, 0x01, 0x02, 0x02, 0x01, 0x0A, 0x2B, 0x7E};
static const uint8_t V_FIND_ME_0[] = {0xAA, 0x55, 0x01, 0x02, 0x0D, 0x04, 0x01, 0x03, 0x02, 0x01, 0x00, 0xFC, 0x80};
static const uint8_t V_REQ_TEL[] = {0xAA, 0x55, 0x01, 0x02, 0x0C, 0x04, 0x01, 0x04, 0x03, 0x00, 0x6B, 0xCC};
static const uint8_t V_ACK_FIND_ME[] = {0xAA, 0x55, 0x01, 0x03, 0x0C, 0x04, 0x01, 0x02, 0x02, 0x00, 0x52, 0x3C};

void test_crc_check_value() {
  const char* s = "123456789";
  TEST_ASSERT_EQUAL_HEX16(0x29B1, crc16_ccitt_false((const uint8_t*)s, 9));
}

static Telemetry baseTelemetry() {
  Telemetry t;
  clearTelemetry(t);
  t.seq = 1;
  t.flags = 0x06;  // fix 3D + escucha continua
  t.lat_e6 = -34603722;
  t.lon_e6 = -58381592;
  t.battery = 85;
  t.fix_age = 2;
  return t;
}

void test_encode_telemetry_base_matches_vector() {
  uint8_t out[64];
  Telemetry t = baseTelemetry();
  TEST_ASSERT_EQUAL(sizeof(V_TEL_BASE), encodeTelemetry(out, sizeof(out), DEV, t));
  TEST_ASSERT_EQUAL_HEX8_ARRAY(V_TEL_BASE, out, sizeof(V_TEL_BASE));
}

void test_decode_telemetry_base() {
  Frame f;
  TEST_ASSERT_EQUAL(kDecodeOk, decodeFrame(V_TEL_BASE, sizeof(V_TEL_BASE), DEV, f));
  TEST_ASSERT_EQUAL(kTypeTelemetry, f.type);
  TEST_ASSERT_EQUAL_HEX16(DEV, f.dev_id);
  TEST_ASSERT_EQUAL(1, f.telemetry.seq);
  TEST_ASSERT_EQUAL(2, f.telemetry.fix());
  TEST_ASSERT_TRUE(f.telemetry.flags & kFlagEscuchaContinua);
  TEST_ASSERT_EQUAL_INT32(-34603722, f.telemetry.lat_e6);
  TEST_ASSERT_EQUAL_INT32(-58381592, f.telemetry.lon_e6);
  TEST_ASSERT_EQUAL(85, f.telemetry.battery);
  TEST_ASSERT_EQUAL(2, f.telemetry.fix_age);
  TEST_ASSERT_FALSE(f.telemetry.has_fw);
}

void test_encode_telemetry_nofix_matches_vector() {
  uint8_t out[64];
  Telemetry t;
  clearTelemetry(t);
  t.seq = 2;
  t.flags = 0x04;
  t.battery = 84;
  t.fix_age = kUnknownFixAge;
  TEST_ASSERT_EQUAL(sizeof(V_TEL_NOFIX), encodeTelemetry(out, sizeof(out), DEV, t));
  TEST_ASSERT_EQUAL_HEX8_ARRAY(V_TEL_NOFIX, out, sizeof(V_TEL_NOFIX));
}

void test_encode_telemetry_reboot_with_fw_matches_vector() {
  uint8_t out[64];
  Telemetry t = baseTelemetry();
  t.seq = 0;
  t.flags = 0x16;
  t.battery = 100;
  t.fix_age = 0;
  t.has_fw = true;
  t.fw[0] = 1; t.fw[1] = 0; t.fw[2] = 0;
  TEST_ASSERT_EQUAL(sizeof(V_TEL_REBOOT), encodeTelemetry(out, sizeof(out), DEV, t));
  TEST_ASSERT_EQUAL_HEX8_ARRAY(V_TEL_REBOOT, out, sizeof(V_TEL_REBOOT));

  Frame f;
  TEST_ASSERT_EQUAL(kDecodeOk, decodeFrame(V_TEL_REBOOT, sizeof(V_TEL_REBOOT), DEV, f));
  TEST_ASSERT_TRUE(f.telemetry.flags & kFlagReinicio);
  TEST_ASSERT_TRUE(f.telemetry.has_fw);
  TEST_ASSERT_EQUAL(1, f.telemetry.fw[0]);
}

static void checkCommand(const uint8_t* v, size_t n, uint8_t id, uint8_t code, uint8_t plen,
                         const uint8_t* params) {
  Command c;
  memset(&c, 0, sizeof(c));
  c.cmd_id = id; c.code = code; c.plen = plen;
  memcpy(c.params, params, plen);
  uint8_t out[64];
  TEST_ASSERT_EQUAL(n, encodeCommand(out, sizeof(out), DEV, c));
  TEST_ASSERT_EQUAL_HEX8_ARRAY(v, out, n);
  Frame f;
  TEST_ASSERT_EQUAL(kDecodeOk, decodeFrame(v, n, DEV, f));
  TEST_ASSERT_EQUAL(kTypeCommand, f.type);
  TEST_ASSERT_EQUAL(id, f.command.cmd_id);
  TEST_ASSERT_EQUAL(code, f.command.code);
  TEST_ASSERT_EQUAL(plen, f.command.plen);
}

void test_command_vectors() {
  const uint8_t p15[] = {0x00, 0x0F};
  const uint8_t p10[] = {0x0A};
  const uint8_t p0[] = {0x00};
  checkCommand(V_SET_INTERVAL_15, sizeof(V_SET_INTERVAL_15), 1, kCmdSetInterval, 2, p15);
  checkCommand(V_FIND_ME_10, sizeof(V_FIND_ME_10), 2, kCmdFindMe, 1, p10);
  checkCommand(V_FIND_ME_0, sizeof(V_FIND_ME_0), 3, kCmdFindMe, 1, p0);
  checkCommand(V_REQ_TEL, sizeof(V_REQ_TEL), 4, kCmdRequestTelemetry, 0, p0);
}

void test_ack_vector() {
  Ack a = {2, kCmdFindMe, kAckOk};
  uint8_t out[16];
  TEST_ASSERT_EQUAL(12, encodeAck(out, sizeof(out), DEV, a));
  TEST_ASSERT_EQUAL_HEX8_ARRAY(V_ACK_FIND_ME, out, 12);
}

void test_validation_order_and_rejections() {
  uint8_t b[64];
  Frame f;
  memcpy(b, V_TEL_BASE, sizeof(V_TEL_BASE));
  b[1] = 0x56;
  TEST_ASSERT_EQUAL(kDecodeBadSync, decodeFrame(b, sizeof(V_TEL_BASE), DEV, f));

  memcpy(b, V_TEL_BASE, sizeof(V_TEL_BASE));
  b[2] = 0x02;
  TEST_ASSERT_EQUAL(kDecodeBadVersion, decodeFrame(b, sizeof(V_TEL_BASE), DEV, f));

  TEST_ASSERT_EQUAL(kDecodeBadLength, decodeFrame(V_TEL_BASE, sizeof(V_TEL_BASE) - 1, DEV, f));

  memcpy(b, V_TEL_BASE, sizeof(V_TEL_BASE));
  b[12] ^= 0x01;  // corrupción en LAT
  TEST_ASSERT_EQUAL(kDecodeBadCrc, decodeFrame(b, sizeof(V_TEL_BASE), DEV, f));

  TEST_ASSERT_EQUAL(kDecodeWrongDevice, decodeFrame(V_TEL_BASE, sizeof(V_TEL_BASE), 0x0101, f));
  TEST_ASSERT_EQUAL(kDecodeOk, decodeFrame(V_TEL_BASE, sizeof(V_TEL_BASE), 0, f));  // sniffer
}

void test_unknown_type_rejected() {
  uint8_t b[12] = {0xAA, 0x55, 0x01, 0x09, 0x0C, 0x04, 0x01, 0x00, 0x00, 0x00, 0, 0};
  putU16BE(b + 10, crc16_ccitt_false(b + 2, 8));
  Frame f;
  TEST_ASSERT_EQUAL(kDecodeUnknownType, decodeFrame(b, 12, DEV, f));
}

void test_unknown_tlv_skipped_and_overflow_rejected() {
  // Telemetría + TLV ajeno 0x70 (Grupo 7) + FW_VERSION
  uint8_t b[64];
  memcpy(b, V_TEL_BASE, 21);
  const uint8_t tlvs[] = {0x70, 0x02, 0xBE, 0xEF, 0x01, 0x03, 0x02, 0x01, 0x00};
  memcpy(b + 21, tlvs, sizeof(tlvs));
  uint8_t len = 21 + sizeof(tlvs) + 2;
  b[4] = len;
  putU16BE(b + len - 2, crc16_ccitt_false(b + 2, len - 4));
  Frame f;
  TEST_ASSERT_EQUAL(kDecodeOk, decodeFrame(b, len, DEV, f));
  TEST_ASSERT_TRUE(f.telemetry.has_fw);
  TEST_ASSERT_EQUAL(2, f.telemetry.fw[0]);

  // TLV cuyo L se sale de LEN-2 => BAD_BODY
  b[22] = 0x10;
  putU16BE(b + len - 2, crc16_ccitt_false(b + 2, len - 4));
  TEST_ASSERT_EQUAL(kDecodeBadBody, decodeFrame(b, len, DEV, f));
}

void test_command_plen_mismatch_rejected() {
  uint8_t b[14];
  memcpy(b, V_SET_INTERVAL_15, 14);
  b[9] = 3;  // PLEN no coincide con LEN
  putU16BE(b + 12, crc16_ccitt_false(b + 2, 10));
  Frame f;
  TEST_ASSERT_EQUAL(kDecodeBadBody, decodeFrame(b, 14, DEV, f));
}

void test_group1_power_tlv_roundtrip() {
  Telemetry t = baseTelemetry();
  t.flags = 0x02 | kFlagModoAhorro;
  t.has_power_profile = true;
  t.power_mode = 1;
  t.power_interval_s = 150;
  uint8_t out[64];
  size_t n = encodeTelemetry(out, sizeof(out), DEV, t);
  TEST_ASSERT_EQUAL(28, n);
  Frame f;
  TEST_ASSERT_EQUAL(kDecodeOk, decodeFrame(out, n, DEV, f));
  TEST_ASSERT_TRUE(f.telemetry.has_power_profile);
  TEST_ASSERT_EQUAL(150, f.telemetry.power_interval_s);
}

static int feedAll(FrameStreamParser& p, const uint8_t* d, size_t n, uint8_t* last, uint8_t* last_len) {
  int frames = 0;
  for (size_t i = 0; i < n; ++i) {
    if (p.feed(d[i])) {
      ++frames;
      *last_len = p.frameLen();
      memcpy(last, p.frame(), p.frameLen());
    }
  }
  return frames;
}

void test_stream_parser_resync_with_noise_and_fake_sync() {
  FrameStreamParser p;
  uint8_t stream[200];
  size_t n = 0;
  const char* log = "# log de texto ASCII\r\n";
  memcpy(stream + n, log, strlen(log)); n += strlen(log);
  // falso AA 55 con LEN plausible pero CRC inválido, seguido de una trama real
  const uint8_t fake[] = {0xAA, 0x55, 0x01, 0x01, 0x0C};
  memcpy(stream + n, fake, sizeof(fake)); n += sizeof(fake);
  memcpy(stream + n, V_ACK_FIND_ME, 12); n += 12;
  memcpy(stream + n, V_TEL_BASE, sizeof(V_TEL_BASE)); n += sizeof(V_TEL_BASE);

  uint8_t last[64], last_len = 0;
  int frames = feedAll(p, stream, n, last, &last_len);
  TEST_ASSERT_EQUAL(2, frames);
  TEST_ASSERT_EQUAL(sizeof(V_TEL_BASE), last_len);
  TEST_ASSERT_EQUAL_HEX8_ARRAY(V_TEL_BASE, last, last_len);
}

void test_stream_parser_back_to_back_frames() {
  FrameStreamParser p;
  uint8_t stream[64];
  memcpy(stream, V_FIND_ME_10, 13);
  memcpy(stream + 13, V_REQ_TEL, 12);
  uint8_t last[64], last_len = 0;
  TEST_ASSERT_EQUAL(2, feedAll(p, stream, 25, last, &last_len));
  TEST_ASSERT_EQUAL_HEX8_ARRAY(V_REQ_TEL, last, 12);
}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_crc_check_value);
  RUN_TEST(test_encode_telemetry_base_matches_vector);
  RUN_TEST(test_decode_telemetry_base);
  RUN_TEST(test_encode_telemetry_nofix_matches_vector);
  RUN_TEST(test_encode_telemetry_reboot_with_fw_matches_vector);
  RUN_TEST(test_command_vectors);
  RUN_TEST(test_ack_vector);
  RUN_TEST(test_validation_order_and_rejections);
  RUN_TEST(test_unknown_type_rejected);
  RUN_TEST(test_unknown_tlv_skipped_and_overflow_rejected);
  RUN_TEST(test_command_plen_mismatch_rejected);
  RUN_TEST(test_group1_power_tlv_roundtrip);
  RUN_TEST(test_stream_parser_resync_with_noise_and_fake_sync);
  RUN_TEST(test_stream_parser_back_to_back_frames);
  return UNITY_END();
}
