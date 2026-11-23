// CRC-16/CCITT-FALSE: poly 0x1021, init 0xFFFF, sin reflexión, sin XOR final.
// Test vector: crc16_ccitt_false("123456789") == 0x29B1
#pragma once
#include <stddef.h>
#include <stdint.h>

namespace pet {

uint16_t crc16_ccitt_false(const uint8_t* data, size_t len, uint16_t crc = 0xFFFF);

}  // namespace pet
