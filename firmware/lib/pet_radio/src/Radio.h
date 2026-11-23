// Capa Radio: aísla el módulo LoRa concreto para poder simular (requisito
// "Independencia del radio"). Implementaciones: RadioSim (serie) y RadioLoRa (SX1278).
#pragma once
#include <stdint.h>

class Radio {
 public:
  virtual ~Radio() {}
  virtual bool begin() = 0;
  // Transmite una trama completa (bloqueante hasta fin de TX).
  virtual bool send(const uint8_t* data, uint8_t len) = 0;
  // Sondea la recepción. Devuelve el largo de una trama recibida (copiada en buf)
  // o 0 si no hay nada. RadioSim ya entrega tramas con SYNC/LEN/CRC válidos.
  virtual uint8_t poll(uint8_t* buf, uint8_t cap) = 0;
  // Bajo consumo entre ventanas de RX (no-op en simulación).
  virtual void sleep() = 0;
  virtual void wake() = 0;
  // Métricas del último paquete (simuladas en RadioSim).
  virtual int16_t lastRssi() const = 0;
  virtual int8_t lastSnr() const = 0;
};
