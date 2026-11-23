#!/usr/bin/env python3
"""Convierte una ruta GPX (la de ejemplo de la cátedra u otra) en route_data.h.

    python firmware/tools/gpx_to_route.py ruta.gpx [--max 40] [--segment-ms 20000] > firmware/src/collar/route_data.h

El Nano tiene 32 KB de flash: se submuestrea a --max puntos (PROGMEM, 8 bytes c/u).
"""
from __future__ import annotations

import argparse
import xml.etree.ElementTree as ET


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("gpx")
    ap.add_argument("--max", type=int, default=40)
    ap.add_argument("--segment-ms", type=int, default=20000)
    a = ap.parse_args()
    pts = [(float(e.get("lat")), float(e.get("lon")))
           for e in ET.parse(a.gpx).iter() if e.tag.endswith(("trkpt", "rtept", "wpt"))]
    if not pts:
        raise SystemExit("El GPX no tiene trkpt/rtept/wpt")
    step = max(1, len(pts) // a.max)
    pts = pts[::step][: a.max]
    print("// Generado por tools/gpx_to_route.py — no editar a mano.")
    print("#pragma once\n#include <avr/pgmspace.h>\n#include <stdint.h>\n")
    print("static const int32_t kRoute[][2] PROGMEM = {")
    for lat, lon in pts:
        print(f"    {{{round(lat * 1e6)}, {round(lon * 1e6)}}},")
    print("};")
    print("static const uint8_t kRouteLen = sizeof(kRoute) / sizeof(kRoute[0]);")
    print(f"static const uint32_t kRouteSegmentMs = {a.segment_ms}UL;")


if __name__ == "__main__":
    main()
