// Logging mínimo. Nunca loguear secretos/tokens (requisito "Diagnóstico").
#pragma once
#include <Arduino.h>

#include "config.h"

#if LOG_ENABLED
#define LOG_BEGIN() Serial.print(F("# "))
#define LOG(x) Serial.print(x)
#define LOGLN(x) Serial.println(x)
#define LOGHEX(x) Serial.print((x), HEX)
#else
#define LOG_BEGIN() do {} while (0)
#define LOG(x) do {} while (0)
#define LOGLN(x) do {} while (0)
#define LOGHEX(x) do {} while (0)
#endif

// En simulación las tramas y los logs comparten el puerto: tras cada trama se
// emite un salto de línea para que los logs siempre empiecen a principio de línea
// (lo necesitan wait-serial de los escenarios de wokwi-cli y el bridge).
#if LOG_ENABLED && !RADIO_LORA
#define LOG_FRAME_END() Serial.print(F("\r\n"))
#else
#define LOG_FRAME_END() do {} while (0)
#endif

inline void logHexBytes(const uint8_t* d, uint8_t n) {
#if LOG_ENABLED
  for (uint8_t i = 0; i < n; ++i) {
    if (d[i] < 0x10) Serial.print('0');
    Serial.print(d[i], HEX);
  }
#else
  (void)d; (void)n;
#endif
}
