// Tests del perfil BLE v1 (vectores oficiales de Ovenbird) y de la lógica
// pura de collar/unidad (idempotencia, dedup SEQ, collar_online, cola de comandos).
#include <stdio.h>
#include <string.h>
#include <unity.h>

#include "ble_codec.h"
#include "collar_logic.h"
#include "frame.h"
#include "nmea_sim.h"
#include "unit_logic.h"

using namespace pet;

void setUp() {}
void tearDown() {}

// ---- Vectores docs/vendor/ble-test-vectors.json ------------------------------
void test_ble_location_valid() {
  const uint8_t v[] = {0x28, 0xd2, 0x58, 0xe9, 0x30, 0xb2, 0xb3, 0xdd,
                       0x78, 0x00, 0x03, 0x00, 0xe0, 0xb5, 0x2f, 0x67};
  ble::Location l = {-380055000, -575426000, 120, 3, 1731180000UL};
  uint8_t out[16];
  ble::encodeLocation(l, out);
  TEST_ASSERT_EQUAL_HEX8_ARRAY(v, out, 16);
}

void test_ble_location_no_fix() {
  const uint8_t v[] = {0, 0, 0, 0, 0, 0, 0, 0, 0xff, 0xff, 0, 0, 0, 0, 0, 0};
  ble::Location l = {123, 456, 0xFFFF, 0, 0};  // sin fix => lat/lon forzados a 0
  uint8_t out[16];
  ble::encodeLocation(l, out);
  TEST_ASSERT_EQUAL_HEX8_ARRAY(v, out, 16);
}

void test_ble_status_normal() {
  const uint8_t v[] = {0x57, 0xa4, 0x07, 0x01, 0x29, 0x00, 0x03, 0x00};
  ble::Status s = {87, -92, 7, true, 41, 3};
  uint8_t out[8];
  ble::encodeStatus(s, out);
  TEST_ASSERT_EQUAL_HEX8_ARRAY(v, out, 8);
}

void test_ble_status_extreme() {
  const uint8_t v[] = {0xff, 0x88, 0xfb, 0x00, 0xff, 0xff, 0xff, 0xff};
  ble::Status s = {255, -120, -5, false, 65535, 65535};
  uint8_t out[8];
  ble::encodeStatus(s, out);
  TEST_ASSERT_EQUAL_HEX8_ARRAY(v, out, 8);
}

void test_ble_command_find_me() {
  const uint8_t v[] = {0x07, 0x00, 0x01, 0x0a, 0x00};
  ble::Command c;
  TEST_ASSERT_TRUE(ble::decodeCommand(v, 5, c));
  TEST_ASSERT_EQUAL(7, c.cmd_id);
  TEST_ASSERT_EQUAL(ble::kOpFindMe, c.opcode);
  TEST_ASSERT_EQUAL(10, c.arg);
  TEST_ASSERT_FALSE(ble::decodeCommand(v, 4, c));
}

void test_ble_command_ack_ok() {
  const uint8_t v[] = {0x07, 0x00, 0x00};
  ble::Ack a = {7, ble::kAckOk};
  uint8_t out[3];
  ble::encodeAck(a, out);
  TEST_ASSERT_EQUAL_HEX8_ARRAY(v, out, 3);
}

void test_lora_to_ble_conversions() {
  TEST_ASSERT_EQUAL_INT32(-346037220, ble::e6ToE7(-34603722));
  TEST_ASSERT_EQUAL(0, ble::loraFixToBle(0));
  TEST_ASSERT_EQUAL(2, ble::loraFixToBle(1));
  TEST_ASSERT_EQUAL(3, ble::loraFixToBle(2));
}

// ---- Collar ------------------------------------------------------------------
static Command mk(uint8_t id, uint8_t code, uint8_t plen, uint8_t p0 = 0, uint8_t p1 = 0) {
  Command c;
  memset(&c, 0, sizeof(c));
  c.cmd_id = id; c.code = code; c.plen = plen; c.params[0] = p0; c.params[1] = p1;
  return c;
}

void test_collar_set_interval_and_power_profile() {
  CollarCommandHandler h;
  CommandEffects fx;
  Ack a = h.handle(mk(1, kCmdSetInterval, 2, 0x00, 150), fx);
  TEST_ASSERT_EQUAL(kAckOk, a.result);
  TEST_ASSERT_TRUE(fx.interval_changed);
  TEST_ASSERT_EQUAL(150, fx.interval_s);
  PowerProfile p = profileForInterval(150);
  TEST_ASSERT_TRUE(p.power_save);
  TEST_ASSERT_FALSE(p.continuous_rx);
  p = profileForInterval(99);
  TEST_ASSERT_FALSE(p.power_save);
  TEST_ASSERT_TRUE(p.continuous_rx);
}

void test_collar_invalid_params() {
  CollarCommandHandler h;
  CommandEffects fx;
  TEST_ASSERT_EQUAL(kAckInvalidParam, h.handle(mk(1, kCmdSetInterval, 2, 0x00, 4), fx).result);
  TEST_ASSERT_EQUAL(kAckInvalidParam, h.handle(mk(2, kCmdSetInterval, 2, 0x0E, 0x11), fx).result);  // 3601
  TEST_ASSERT_EQUAL(kAckInvalidParam, h.handle(mk(3, kCmdFindMe, 1, 61), fx).result);
  TEST_ASSERT_EQUAL(kAckUnsupported, h.handle(mk(4, 0x70, 0), fx).result);
}

void test_collar_idempotency() {
  CollarCommandHandler h;
  CommandEffects fx;
  Ack a1 = h.handle(mk(9, kCmdFindMe, 1, 10), fx);
  TEST_ASSERT_TRUE(fx.find_me);
  Ack a2 = h.handle(mk(9, kCmdFindMe, 1, 10), fx);  // retransmisión
  TEST_ASSERT_FALSE(fx.find_me);                     // no re-ejecuta
  TEST_ASSERT_EQUAL(a1.cmd_id, a2.cmd_id);
  TEST_ASSERT_EQUAL(a1.result, a2.result);
}

void test_find_me_auto_off() {
  FindMeTimer t;
  t.start(10, 1000);
  TEST_ASSERT_TRUE(t.active(5000));
  TEST_ASSERT_FALSE(t.active(11000));
  t.start(5, 0xFFFFF000UL);  // wrap-around de millis()
  TEST_ASSERT_TRUE(t.active(0x00000100UL));
  TEST_ASSERT_FALSE(t.active(0x00001000UL));
  t.start(30, 0);
  t.start(0, 10);  // FIND_ME 0 apaga
  TEST_ASSERT_FALSE(t.active(20));
}

// ---- Unidad ------------------------------------------------------------------
void test_seq_dedup() {
  SeqDeduplicator d;
  TEST_ASSERT_TRUE(d.accept(10, false));
  TEST_ASSERT_TRUE(d.accept(11, false));
  TEST_ASSERT_FALSE(d.accept(10, false));
  TEST_ASSERT_TRUE(d.accept(12, false));
  TEST_ASSERT_TRUE(d.accept(13, false));
  TEST_ASSERT_TRUE(d.accept(14, false));
  TEST_ASSERT_TRUE(d.accept(10, false));  // ya salió de los últimos 4
  // Reinicio del collar: SEQ vuelve a 0 y se limpia el historial
  TEST_ASSERT_TRUE(d.accept(0, true));
  TEST_ASSERT_FALSE(d.accept(0, true));   // retransmisión de la trama de reinicio
  TEST_ASSERT_TRUE(d.accept(1, true));
  TEST_ASSERT_TRUE(d.accept(2, true));
  TEST_ASSERT_TRUE(d.accept(3, false));
  TEST_ASSERT_EQUAL(2, d.duplicates());
}

void test_online_tracker() {
  OnlineTracker o;
  TEST_ASSERT_FALSE(o.online(0));
  o.onValidFrame(1000);
  TEST_ASSERT_TRUE(o.online(60999));
  TEST_ASSERT_FALSE(o.online(61000));  // I desconocido, modo normal => 60 s
  o.setPowerSaveHint(true);
  TEST_ASSERT_TRUE(o.online(300000));  // ahorro sin I => 360 s
  o.setKnownInterval(150);             // 2*150+30 = 330 s
  TEST_ASSERT_EQUAL_UINT32(330000UL, o.offlineAfterMs());
  o.setKnownInterval(15);              // max(60, 60) = 60 s
  TEST_ASSERT_EQUAL_UINT32(60000UL, o.offlineAfterMs());
}

void test_ble_to_lora_mapping() {
  ble::Command b = {7, ble::kOpFindMe, 10};
  Command c;
  TEST_ASSERT_TRUE(bleToLoraCommand(b, 2, c));
  TEST_ASSERT_EQUAL(kCmdFindMe, c.code);
  TEST_ASSERT_EQUAL(1, c.plen);
  TEST_ASSERT_EQUAL(10, c.params[0]);
  b.opcode = ble::kOpSetInterval; b.arg = 150;
  TEST_ASSERT_TRUE(bleToLoraCommand(b, 3, c));
  TEST_ASSERT_EQUAL(kCmdSetInterval, c.code);
  TEST_ASSERT_EQUAL(150, getU16BE(c.params));
  b.arg = 4;
  TEST_ASSERT_FALSE(bleToLoraCommand(b, 4, c));
  b.opcode = 9;
  TEST_ASSERT_FALSE(bleToLoraCommand(b, 5, c));
  TEST_ASSERT_EQUAL(ble::kAckOk, loraResultToBle(kAckOk));
  TEST_ASSERT_EQUAL(ble::kAckUnsupported, loraResultToBle(kAckInvalidParam));
}

void test_queue_continuous_retries_then_expires() {
  UnitCommandQueue q;
  Command c = mk(1, kCmdFindMe, 1, 5);
  TEST_ASSERT_TRUE(q.enqueue(c, 70, 0));
  TEST_ASSERT_NOT_NULL(q.nextToSend(0, true, 0, 0));      // envío inmediato
  TEST_ASSERT_NULL(q.nextToSend(500, true, 0, 0));        // espera 1 s
  TEST_ASSERT_NOT_NULL(q.nextToSend(1000, true, 0, 0));   // reintento 1
  TEST_ASSERT_NOT_NULL(q.nextToSend(2000, true, 0, 0));   // reintento 2
  TEST_ASSERT_NOT_NULL(q.nextToSend(3000, true, 0, 0));   // reintento 3
  TEST_ASSERT_NULL(q.nextToSend(4000, true, 0, 0));
  uint16_t ble_id;
  TEST_ASSERT_TRUE(q.popExpired(4000, true, ble_id));
  TEST_ASSERT_EQUAL(70, ble_id);
  TEST_ASSERT_EQUAL(0, q.size());
}

void test_queue_window_mode_and_ack() {
  UnitCommandQueue q;
  TEST_ASSERT_TRUE(q.enqueue(mk(1, kCmdSetInterval, 2, 0, 15), 11, 0));
  TEST_ASSERT_TRUE(q.enqueue(mk(2, kCmdFindMe, 1, 5), 12, 0));
  TEST_ASSERT_TRUE(q.enqueue(mk(3, kCmdRequestTelemetry, 0), 13, 0));
  TEST_ASSERT_TRUE(q.enqueue(mk(4, kCmdFindMe, 1, 0), 14, 0));
  TEST_ASSERT_FALSE(q.enqueue(mk(5, kCmdFindMe, 1, 0), 15, 0));  // cola llena => busy

  TEST_ASSERT_NULL(q.nextToSend(100, false, 0, 0));      // sin telemetría todavía
  // Llega telemetría #1 en t=150000: se envían las 4 dentro de 100 ms
  for (int i = 0; i < 4; ++i) TEST_ASSERT_NOT_NULL(q.nextToSend(150010, false, 150000, 1));
  TEST_ASSERT_NULL(q.nextToSend(150020, false, 150000, 1));
  TEST_ASSERT_NULL(q.nextToSend(150200, false, 150000, 1));

  Ack a = {2, kCmdFindMe, kAckOk};
  uint16_t ble_id; uint8_t res;
  TEST_ASSERT_TRUE(q.onAck(a, ble_id, res));
  TEST_ASSERT_EQUAL(12, ble_id);
  TEST_ASSERT_EQUAL(3, q.size());
  Ack wrong = {99, kCmdFindMe, kAckOk};
  TEST_ASSERT_FALSE(q.onAck(wrong, ble_id, res));
}

// Hallado en la prueba E2E con Wokwi: después de confirmar el paso a ahorro, la unidad
// tiene que dejar de mandar comandos "al instante" (el collar ya no escucha siempre).
void test_continuous_rx_after_set_interval_ack() {
  Command ahorro = mk(1, kCmdSetInterval, 2, 0, 150);
  Command normal = mk(2, kCmdSetInterval, 2, 0, 15);
  Command find = mk(3, kCmdFindMe, 1, 5);
  TEST_ASSERT_FALSE(continuousRxAfterAck(ahorro, kAckOk, true));
  TEST_ASSERT_TRUE(continuousRxAfterAck(normal, kAckOk, false));
  // Umbral exacto del firmware del collar: 100 s ya es ahorro.
  TEST_ASSERT_FALSE(continuousRxAfterAck(mk(4, kCmdSetInterval, 2, 0, 100), kAckOk, true));
  TEST_ASSERT_TRUE(continuousRxAfterAck(mk(5, kCmdSetInterval, 2, 0, 99), kAckOk, false));
  // Sin cambios si no se aplicó o no es SET_INTERVAL.
  TEST_ASSERT_TRUE(continuousRxAfterAck(ahorro, kAckInvalidParam, true));
  TEST_ASSERT_FALSE(continuousRxAfterAck(find, kAckOk, false));
  TEST_ASSERT_TRUE(continuousRxAfterAck(find, kAckOk, true));
}

void test_nmea_checksum_and_format() {
  NmeaFix f = {-38005500, -57542600, 12, 34, 56, 23, 11, 26, 8, 120, true};
  char buf[100];
  size_t n = buildGPRMC(f, buf, sizeof(buf));
  TEST_ASSERT_TRUE(n > 0);
  TEST_ASSERT_EQUAL_STRING_LEN("$GPRMC,123456.00,A,3800.3300,S,05732.5560,W", buf, 43);
  // checksum correcto
  char* star = strchr(buf, '*');
  TEST_ASSERT_NOT_NULL(star);
  char hex[3];
  snprintf(hex, sizeof(hex), "%02X", nmeaChecksum(buf));
  TEST_ASSERT_EQUAL_STRING_LEN(hex, star + 1, 2);
  n = buildGPGGA(f, buf, sizeof(buf));
  TEST_ASSERT_TRUE(n > 0);
  TEST_ASSERT_NOT_NULL(strstr(buf, ",1,08,1.20,"));
}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_ble_location_valid);
  RUN_TEST(test_ble_location_no_fix);
  RUN_TEST(test_ble_status_normal);
  RUN_TEST(test_ble_status_extreme);
  RUN_TEST(test_ble_command_find_me);
  RUN_TEST(test_ble_command_ack_ok);
  RUN_TEST(test_lora_to_ble_conversions);
  RUN_TEST(test_collar_set_interval_and_power_profile);
  RUN_TEST(test_collar_invalid_params);
  RUN_TEST(test_collar_idempotency);
  RUN_TEST(test_find_me_auto_off);
  RUN_TEST(test_seq_dedup);
  RUN_TEST(test_online_tracker);
  RUN_TEST(test_ble_to_lora_mapping);
  RUN_TEST(test_queue_continuous_retries_then_expires);
  RUN_TEST(test_queue_window_mode_and_ack);
  RUN_TEST(test_continuous_rx_after_set_interval_ack);
  RUN_TEST(test_nmea_checksum_and_format);
  return UNITY_END();
}
