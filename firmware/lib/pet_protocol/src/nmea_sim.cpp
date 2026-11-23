#include "nmea_sim.h"

#include <stdio.h>
#include <string.h>

namespace pet {

namespace {

// Convierte grados*1e6 a "ddmm.mmmm" (lat) o "dddmm.mmmm" (lon) + hemisferio.
// Solo aritmética entera (el printf de AVR no soporta %f).
void formatCoord(int32_t v_e6, bool is_lat, char* out, size_t cap, char* hemi) {
  const bool neg = v_e6 < 0;
  uint32_t a = neg ? (uint32_t)(-(int64_t)v_e6) : (uint32_t)v_e6;
  const uint32_t deg = a / 1000000UL;
  const uint32_t frac_e6 = a % 1000000UL;            // fracción de grado x1e6
  const uint32_t min_e4 = (frac_e6 * 60UL + 50UL) / 100UL;  // minutos x1e4
  const uint32_t mins = min_e4 / 10000UL;
  const uint32_t mins_frac = min_e4 % 10000UL;
  if (is_lat) {
    snprintf(out, cap, "%02lu%02lu.%04lu", (unsigned long)deg, (unsigned long)mins,
             (unsigned long)mins_frac);
    *hemi = neg ? 'S' : 'N';
  } else {
    snprintf(out, cap, "%03lu%02lu.%04lu", (unsigned long)deg, (unsigned long)mins,
             (unsigned long)mins_frac);
    *hemi = neg ? 'W' : 'E';
  }
}

size_t finish(char* out, size_t cap, size_t n) {
  if (n == 0 || n + 6 > cap) return 0;
  const uint8_t cs = nmeaChecksum(out);
  int m = snprintf(out + n, cap - n, "*%02X\r\n", cs);
  if (m <= 0) return 0;
  return n + (size_t)m;
}

}  // namespace

uint8_t nmeaChecksum(const char* s) {
  uint8_t cs = 0;
  if (*s == '$') ++s;
  while (*s && *s != '*') cs ^= (uint8_t)*s++;
  return cs;
}

size_t buildGPRMC(const NmeaFix& f, char* out, size_t cap) {
  char lat[16], lon[16], ns, ew;
  formatCoord(f.lat_e6, true, lat, sizeof(lat), &ns);
  formatCoord(f.lon_e6, false, lon, sizeof(lon), &ew);
  int n = snprintf(out, cap, "$GPRMC,%02u%02u%02u.00,%c,%s,%c,%s,%c,0.5,0.0,%02u%02u%02u,,,A",
                   f.hour, f.minute, f.second, f.valid ? 'A' : 'V', lat, ns, lon, ew, f.day,
                   f.month, f.year);
  if (n <= 0 || (size_t)n >= cap) return 0;
  return finish(out, cap, (size_t)n);
}

size_t buildGPGGA(const NmeaFix& f, char* out, size_t cap) {
  char lat[16], lon[16], ns, ew;
  formatCoord(f.lat_e6, true, lat, sizeof(lat), &ns);
  formatCoord(f.lon_e6, false, lon, sizeof(lon), &ew);
  int n = snprintf(out, cap, "$GPGGA,%02u%02u%02u.00,%s,%c,%s,%c,%u,%02u,%u.%02u,10.0,M,0.0,M,,",
                   f.hour, f.minute, f.second, lat, ns, lon, ew, f.valid ? 1u : 0u, f.sats,
                   f.hdop_x100 / 100u, f.hdop_x100 % 100u);
  if (n <= 0 || (size_t)n >= cap) return 0;
  return finish(out, cap, (size_t)n);
}

int32_t lerpE6(int32_t a, int32_t b, uint16_t t_permil) {
  return a + (int32_t)(((int64_t)(b - a) * t_permil) / 1000);
}

}  // namespace pet
