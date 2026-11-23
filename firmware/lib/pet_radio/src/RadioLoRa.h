// RadioLoRa: módulo SX1278 Ra-01 con la librería sandeepmistry/LoRa.
// Parámetros físicos obligatorios (§1): 433.175 MHz, BW 125 kHz, SF7, CR 4/5,
// sync word 0x12, 14 dBm, preámbulo 8, CRC de capa física activado.
#pragma once
#if defined(RADIO_LORA) && RADIO_LORA
#include <Arduino.h>
#include <LoRa.h>
#include <SPI.h>

#include "Radio.h"

class RadioLoRa : public Radio {
 public:
  RadioLoRa(int8_t ss, int8_t rst, int8_t dio0) : ss_(ss), rst_(rst), dio0_(dio0), rssi_(0), snr_(0) {}

  bool begin() override {
    LoRa.setPins(ss_, rst_, dio0_);
    if (!LoRa.begin(433175000L)) return false;
    LoRa.setSignalBandwidth(125E3);
    LoRa.setSpreadingFactor(7);
    LoRa.setCodingRate4(5);
    LoRa.setSyncWord(0x12);
    LoRa.setTxPower(14);
    LoRa.setPreambleLength(8);
    LoRa.enableCrc();
    // Recepción por sondeo: parsePacket() deja el SX1278 en RX_SINGLE.
    return true;
  }

  bool send(const uint8_t* data, uint8_t len) override {
    if (!LoRa.beginPacket()) return false;
    LoRa.write(data, len);
    return LoRa.endPacket() == 1;  // bloqueante
  }

  uint8_t poll(uint8_t* buf, uint8_t cap) override {
    const int size = LoRa.parsePacket();
    if (size <= 0) return 0;
    uint8_t n = 0;
    while (LoRa.available()) {
      const int c = LoRa.read();
      if (n < cap) buf[n++] = (uint8_t)c;
    }
    rssi_ = (int16_t)LoRa.packetRssi();
    snr_ = (int8_t)LoRa.packetSnr();
    return (size <= cap) ? n : 0;  // trama más larga que el buffer => descartar
  }

  void sleep() override { LoRa.sleep(); }
  void wake() override { LoRa.idle(); }
  int16_t lastRssi() const override { return rssi_; }
  int8_t lastSnr() const override { return snr_; }

 private:
  int8_t ss_, rst_, dio0_;
  int16_t rssi_;
  int8_t snr_;
};
#endif
