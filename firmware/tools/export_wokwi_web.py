#!/usr/bin/env python3
"""Exporta collar/unidad como proyecto plano para wokwi.com (entregable: "enlace al
proyecto de Wokwi").

    python firmware/tools/export_wokwi_web.py collar   -> firmware/wokwi/web/collar/
    python firmware/tools/export_wokwi_web.py unit     -> firmware/wokwi/web/unit/

Genera sketch.ino (con los build_flags del entorno *_sim como #define), copia las
librerías propias en plano, diagram.json y libraries.txt. Después: en wokwi.com
crear un proyecto Arduino Nano / ESP32, subir/pegar los archivos y guardar.
Recordatorio: los proyectos gratuitos de Wokwi son PÚBLICOS (solo valores de prueba).
"""
from __future__ import annotations

import re
import shutil
import sys
from pathlib import Path

FW = Path(__file__).resolve().parents[1]

TARGETS = {
    "collar": {
        "src": FW / "src/collar",
        "defines": {"RADIO_LORA": "0", "GPS_SIM": "1", "LOG_ENABLED": "1"},
        "libraries": ["TinyGPSPlus"],
        "radio": ["Radio.h", "RadioSim.h"],
    },
    "unit": {
        "src": FW / "src/unit",
        "defines": {"RADIO_LORA": "0", "ENABLE_BLE": "0", "LOG_ENABLED": "1"},
        "libraries": [],
        "radio": ["Radio.h", "RadioSim.h"],
    },
}
COMMON_DEFINES = {"DEV_ID": "0x0101", "PAIRED_DEV_ID": "0x0101", "FW_MAJOR": "1", "FW_MINOR": "0",
                  "FW_PATCH": "0", "DEFAULT_INTERVAL_S": "15"}


def localize_includes(text: str, local: set[str]) -> str:
    return re.sub(r'#include <([^>]+)>',
                  lambda m: f'#include "{m.group(1)}"' if m.group(1) in local else m.group(0), text)


def main() -> None:
    if len(sys.argv) != 2 or sys.argv[1] not in TARGETS:
        sys.exit(__doc__)
    name = sys.argv[1]
    t = TARGETS[name]
    out = FW / "wokwi/web" / name
    shutil.rmtree(out, ignore_errors=True)
    out.mkdir(parents=True)

    files: list[Path] = list((FW / "lib/pet_protocol/src").glob("*"))
    files += [FW / "lib/pet_radio/src" / r for r in t["radio"]]
    files += [FW / "include/config.h", FW / "include/log.h"]
    files += [p for p in t["src"].glob("*") if p.name != "main.cpp"]
    local = {p.name for p in files}

    for p in files:
        (out / p.name).write_text(localize_includes(p.read_text(), local))

    defines = {**COMMON_DEFINES, **t["defines"]}
    header = "// Generado por tools/export_wokwi_web.py — no editar a mano.\n"
    header += "".join(f"#define {k} {v}\n" for k, v in defines.items())
    # config.h/log.h deben ver los defines: se inyectan también al inicio de config.h
    cfg = out / "config.h"
    cfg.write_text(header + cfg.read_text())
    main_cpp = (t["src"] / "main.cpp").read_text()
    (out / "sketch.ino").write_text(header + localize_includes(main_cpp, local))
    shutil.copy(FW / "wokwi" / name / "diagram.json", out / "diagram.json")
    (out / "libraries.txt").write_text("\n".join(t["libraries"]) + "\n")
    print(f"Exportado en {out} ({len(files) + 3} archivos)")


if __name__ == "__main__":
    main()
