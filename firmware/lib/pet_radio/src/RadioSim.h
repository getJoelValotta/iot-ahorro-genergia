// RadioSim: tramas binarias crudas por un puerto serie (115200 8N1), sin
// encabezados de texto. Recepción con re-sincronización AA 55 (§1 del acuerdo).
#pragma once
#include <Arduino.h>
#include <frame.h>
#include <stream_parser.h>
#include <string.h>

#include "Radio.h"

class RadioSim : public Radio {
 public:
  typedef void (*LineHandler)(const char* line);

  explicit RadioSim(Stream& port) : port_(port), rssi_(-70), snr_(9), line_handler_(0), line_len_(-1) {}

  // Solo simulación: las líneas de texto que empiezan con '>' (y llegan fuera de
  // una trama) se entregan a este handler en vez de al parser. Se usa en la unidad
  // para emular escrituras BLE desde la consola (Wokwi no simula Bluetooth).
  void setLineHandler(LineHandler h) { line_handler_ = h; }

  bool begin() override { return true; }  // el puerto lo abre el main (Serial.begin)

  bool send(const uint8_t* data, uint8_t len) override {
    const size_t n = port_.write(data, len);
    port_.flush();
    return n == len;
  }

  uint8_t poll(uint8_t* buf, uint8_t cap) override {
    while (port_.available() > 0) {
      const int c = port_.read();
      if (c < 0) break;
      if (line_handler_ && consumeText((char)c)) continue;
      if (parser_.feed((uint8_t)c)) {
        const uint8_t n = parser_.frameLen();
        if (n > cap) return 0;
        memcpy(buf, parser_.frame(), n);
        // Métricas "de enlace" simuladas con algo de variación.
        rssi_ = -60 - (int16_t)random(0, 40);
        snr_ = (int8_t)random(-2, 11);
        return n;
      }
    }
    return 0;
  }

  // Con la "radio" dormida lo que llega se pierde, igual que en LoRa real
  // (si no, el buffer de la UART entregaría comandos fuera de la ventana RX).
  void sleep() override {
    while (port_.available() > 0) port_.read();
    parser_.reset();
  }
  void wake() override {}
  int16_t lastRssi() const override { return rssi_; }
  int8_t lastSnr() const override { return snr_; }

 private:
  bool consumeText(char c) {
    if (line_len_ < 0) {
      if (c == '>' && parser_.idle()) { line_len_ = 0; return true; }
      return false;
    }
    if (c == '\n' || c == '\r') {
      line_[line_len_] = '\0';
      line_len_ = -1;
      line_handler_(line_);
      return true;
    }
    if ((uint8_t)c < 0x20 || (uint8_t)c > 0x7E || line_len_ >= (int)sizeof(line_) - 1) {
      line_len_ = -1;  // no era texto: abandonar
      return false;
    }
    line_[line_len_++] = c;
    return true;
  }

  Stream& port_;
  pet::FrameStreamParser parser_;
  int16_t rssi_;
  int8_t snr_;
  LineHandler line_handler_;
  char line_[48];
  int8_t line_len_;
};
