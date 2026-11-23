#include "stream_parser.h"

#include <string.h>

#include "crc16.h"

namespace pet {

void FrameStreamParser::dropFront(uint8_t n) {
  if (n >= len_) {
    len_ = 0;
    return;
  }
  memmove(buf_, buf_ + n, len_ - n);
  len_ -= n;
}

bool FrameStreamParser::feed(uint8_t byte) {
  if (consumed_pending_) {
    dropFront(ready_len_);
    consumed_pending_ = false;
  }
  if (len_ >= kMaxFrameLen) {  // no debería ocurrir; defensa ante desbordes
    dropFront(1);
    ++dropped_;
  }
  buf_[len_++] = byte;
  return tryExtract();
}

bool FrameStreamParser::tryExtract() {
  while (len_ > 0) {
    if (buf_[0] != kSync0) { dropFront(1); ++dropped_; continue; }
    if (len_ < 2) return false;
    if (buf_[1] != kSync1) { dropFront(1); ++dropped_; continue; }
    if (len_ < 3) return false;
    if (buf_[2] != kVersion) { dropFront(1); ++dropped_; continue; }
    if (len_ < 5) return false;
    const uint8_t flen = buf_[4];
    if (flen < kMinFrameLen || flen > kMaxFrameLen) { dropFront(1); ++dropped_; continue; }
    if (len_ < flen) return false;
    const uint16_t crc = crc16_ccitt_false(buf_ + 2, flen - 4);
    if (crc == getU16BE(buf_ + flen - 2)) {
      ready_len_ = flen;
      consumed_pending_ = true;
      return true;
    }
    // CRC inválido: descartar el 0xAA inicial y re-buscar dentro de lo recibido.
    dropFront(1);
    ++dropped_;
  }
  return false;
}

}  // namespace pet
