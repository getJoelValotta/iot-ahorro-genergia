// Re-sincronización de tramas sobre un flujo de bytes (RadioSim por serie).
// Regla §1: buscar AA 55, leer LEN (offset 4), validar 12<=LEN<=64, juntar LEN bytes,
// verificar CRC. Si falla, descartar el primer byte (0xAA) y volver a buscar AA 55
// dentro de lo ya recibido (evita perder una trama real que empieza dentro del payload).
#pragma once
#include <stddef.h>
#include <stdint.h>

#include "frame.h"

namespace pet {

class FrameStreamParser {
 public:
  FrameStreamParser() : len_(0), dropped_(0) {}

  // Alimenta un byte. Devuelve true cuando hay una trama con SYNC/VER/LEN/CRC
  // válidos lista en frame()/frameLen(). La validación de TYPE/DEV_ID/cuerpo
  // queda para decodeFrame().
  bool feed(uint8_t byte);

  const uint8_t* frame() const { return buf_; }
  uint8_t frameLen() const { return ready_len_; }
  uint32_t droppedBytes() const { return dropped_; }
  void reset() { len_ = 0; consumed_pending_ = false; }
  // true si no hay una trama a medio recibir (para demultiplexar texto en simulación).
  bool idle() const { return len_ == 0 || consumed_pending_; }

 private:
  // Revisa el buffer actual; devuelve true si contiene una trama completa válida.
  bool tryExtract();
  void dropFront(uint8_t n);

  uint8_t buf_[kMaxFrameLen];
  uint8_t len_;
  uint8_t ready_len_ = 0;
  uint32_t dropped_;
  bool consumed_pending_ = false;
};

}  // namespace pet
