// Ruta pregrabada para el GPS simulado (grados x 1e6). Vuelta corta en Mar del Plata.
// Regenerar desde un GPX: python tools/gpx_to_route.py data/route.gpx > src/collar/route_data.h
#pragma once
#include <avr/pgmspace.h>
#include <stdint.h>

static const int32_t kRoute[][2] PROGMEM = {
    {-38005500, -57542600}, {-38004300, -57541200}, {-38003100, -57542900},
    {-38003900, -57544800}, {-38005200, -57545600}, {-38006400, -57544100},
    {-38006900, -57542300}, {-38006100, -57541300},
};
static const uint8_t kRouteLen = sizeof(kRoute) / sizeof(kRoute[0]);
static const uint32_t kRouteSegmentMs = 20000UL;  // tiempo entre puntos
