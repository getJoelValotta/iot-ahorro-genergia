"""Unidad de prueba: simula una unidad con su collar directo contra Ovenbird, sin placas ni Wokwi.

Sirve para probar la página (emparejar, vincular, mapa, ahorro) cuando no hay placas o se agotó
la cuota de Wokwi. Hace lo que haría el celular con la app:
  - se empareja con el código que muestra la página (--pair-code),
  - cada intervalo sube una posición que da vueltas por Mar del Plata, la batería y "en línea",
  - recibe los comandos de la nube (cambio de modo, find_me) y los confirma.

Uso:
  python firmware/tools/unidad_prueba.py --pair-code ABC-123
  python firmware/tools/unidad_prueba.py --pair-code ABC-123 --no-responder   # "El collar no respondió"

El UID es de PRUEBA (nunca la MAC de una placa real). Ctrl+C para terminar.
"""
from __future__ import annotations

import argparse
import math
import os
import sys
import time
from typing import Callable

import ble_cloud
from ble_cloud import WRITABLE, OvenbirdBridgeClient

CENTER = (-38.0055, -57.5426)  # Mar del Plata (misma zona que la ruta del GPS simulado)
RADIUS_DEG = 0.0015
STEPS_PER_LAP = 24


class VirtualUnit:
    """Una unidad + collar virtuales. `report()` sube un reporte; `poll()` atiende comandos."""

    def __init__(
        self,
        client: OvenbirdBridgeClient,
        *,
        battery_pct: int = 85,
        interval_s: int = 15,
        respond: bool = True,
        clock: Callable[[], float] = time.time,
        log: Callable[[str], None] = lambda m: None,
    ) -> None:
        self.client = client
        self.battery = float(battery_pct)
        self.interval_s = interval_s
        self.respond = respond
        self.clock = clock
        self.log = log
        self.seq = 0
        self.step = 0

    def _next_seq(self) -> int:
        self.seq += 1
        return self.seq

    def report(self) -> None:
        angle = 2 * math.pi * (self.step % STEPS_PER_LAP) / STEPS_PER_LAP
        self.step += 1
        lat = round(CENTER[0] + RADIUS_DEG * math.sin(angle), 6)
        lon = round(CENTER[1] + RADIUS_DEG * math.cos(angle), 6)
        # Baja un poco por reporte, más rápido en modo normal (solo para que se vea moverse).
        self.battery = max(1.0, self.battery - (0.2 if self.interval_s < 100 else 0.05))
        ts = int(self.clock())
        self.client.ingest(
            [
                {"seq": self._next_seq(), "ts": ts,
                 "dps": {"location": {"lat": lat, "lon": lon, "fix": "3d", "hdop": 1.1}}},
                {"seq": self._next_seq(), "ts": ts,
                 "dps": {"battery_pct": round(self.battery), "collar_online": True,
                         "link_rssi_dbm": -60, "link_snr_db": 9}},
            ]
        )
        self.log(f"reporte: posicion {lat}, {lon} - bateria {round(self.battery)} %")

    def poll(self, wait_s: int) -> None:
        for cmd in self.client.poll_commands(wait_s=wait_s):
            self._handle(cmd)

    def _handle(self, cmd: dict) -> None:
        cid = cmd.get("commandId", "")
        dps = cmd.get("dps") or {}
        if len(dps) != 1 or next(iter(dps)) not in WRITABLE:
            self.client.ack(cid, False, f"comando no soportado: {sorted(dps)}")
            self.log(f"comando rechazado (no soportado): {dps}")
            return
        name, value = next(iter(dps.items()))
        _op, lo, hi = WRITABLE[name]
        if not isinstance(value, int) or not lo <= value <= hi:
            self.client.ack(cid, False, f"{name} fuera de rango ({lo}..{hi})")
            self.log(f"comando rechazado (fuera de rango): {dps}")
            return
        if not self.respond:
            self.client.ack(cid, False, "sin respuesta del collar")
            self.log(f"comando {dps} -> simulo que el collar NO respondio")
            return
        self.client.ack(cid, True)  # primero confirmar; el log es solo informativo
        if name == "report_interval_s":
            self.interval_s = value
            modo = "AHORRO" if value >= 100 else "NORMAL"
            self.log(f"comando: intervalo {value} s -> modo {modo} (confirmado)")
        else:
            self.log(f"comando: find_me {value} s -> el collar suena (confirmado)")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--pair-code", required=True, help="código que muestra la página (vence a los 10 min)")
    ap.add_argument("--uid", default="02:47:31:00:00:09", help="UID (MAC) de PRUEBA; nunca uno real")
    ap.add_argument("--name", default="OB-0009 (unidad de prueba)", help="nombre en Ovenbird")
    ap.add_argument("--bateria", type=int, default=85, help="batería inicial en %% (por defecto 85)")
    ap.add_argument("--no-responder", action="store_true", help="rechaza los comandos como si el collar no respondiera")
    ap.add_argument("--max-espera", type=int, default=15,
                    help="máximo de segundos entre reportes en ahorro (por defecto 15, para no esperar 150 s)")
    args = ap.parse_args()
    # Consolas de Windows con otra codificación: nunca cortar el programa por un carácter.
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(errors="replace")

    def log(m: str) -> None:
        print(time.strftime("%H:%M:%S"), m, flush=True)

    client = OvenbirdBridgeClient(os.environ.get("OVENBIRD_URL", ble_cloud.DEFAULT_URL), log=log)
    device_id = client.pair(args.pair_code, args.uid, args.name)
    log(f"emparejada en Ovenbird como '{args.name}' (deviceId {device_id}). Ctrl+C para terminar.")
    unit = VirtualUnit(client, battery_pct=args.bateria, respond=not args.no_responder, log=log)
    try:
        while True:
            unit.report()
            # La espera larga (long-poll) de comandos hace de pausa entre reportes.
            deadline = time.time() + min(unit.interval_s, args.max_espera)
            while (left := deadline - time.time()) > 0:
                unit.poll(wait_s=max(1, int(left)))
    except KeyboardInterrupt:
        log("fin de la unidad de prueba")


if __name__ == "__main__":
    main()
