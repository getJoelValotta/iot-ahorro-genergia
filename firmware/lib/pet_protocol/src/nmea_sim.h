// Generador de sentencias NMEA ($GPRMC / $GPGGA) a partir de una ruta pregrabada.
// El collar simulado las genera y las procesa con TinyGPS++, igual que con el NEO-6M real.
#pragma once
#include <stddef.h>
#include <stdint.h>

namespace pet {

struct NmeaFix {
  int32_t lat_e6;
  int32_t lon_e6;
  uint8_t hour, minute, second;
  uint8_t day, month, year;  // year: 2 dígitos
  uint8_t sats;
  uint16_t hdop_x100;
  bool valid;
};

// Escribe una sentencia terminada en "\r\n" y '\0'. Devuelve largo (sin '\0') o 0.
size_t buildGPRMC(const NmeaFix& f, char* out, size_t cap);
size_t buildGPGGA(const NmeaFix& f, char* out, size_t cap);

uint8_t nmeaChecksum(const char* body);  // XOR de los caracteres entre '$' y '*'

// Interpolación lineal entre puntos de ruta (para mover la mascota suavemente).
int32_t lerpE6(int32_t a, int32_t b, uint16_t t_permil);

}  // namespace pet
