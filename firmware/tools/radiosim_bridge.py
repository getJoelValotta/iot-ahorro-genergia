#!/usr/bin/env python3
"""Puente RadioSim entre dos simulaciones (o placas) + consola de pruebas.

Hace de "aire" entre el Collar y la Unidad: lee bytes de cada lado, re-sincroniza
(AA 55), y reenvía SOLO tramas con CRC válido al otro lado (los logs '# ...' se
muestran pero no viajan, como en LoRa real). Opcionalmente inyecta fallas para
demostrar robustez (pérdida, duplicados, corrupción, demora).

Endpoints (pyserial): rfc2217://localhost:4000 (Wokwi VS Code), COM5 o
/dev/ttyUSB0 (placa real / USB-serie de otro grupo), socket://host:port.

Modos:
  --collar X --unit Y   puente completo (collar Wokwi <-> unidad Wokwi)
  --collar X            UNIDAD VIRTUAL: la consola manda comandos LoRa al collar
  --unit Y              COLLAR VIRTUAL: genera telemetría y responde ACKs
  --cloud               + CELULAR FALSO: empareja la unidad en Ovenbird con --pair-code, sube
                        lo que publica por BLE y le pasa los comandos de la nube (ble_cloud.py).
                        URL: variable OVENBIRD_URL (por defecto la plataforma oficial).

Consola (stdin):
  find <s>        FIND_ME (0..60)          interval <s>   SET_INTERVAL (5..3600)
  req             REQUEST_TELEMETRY        ahorro / normal  atajos: interval 150 / 15
  ble <hex>       escribe COMMAND BLE crudo en la unidad (ej: ble 0700010a00)
  chaos loss=0.2 dup=0.1 corrupt=0.05 delay=200     (valores 0..1, delay en ms)
  quit
Con unidad presente, find/interval se envían como COMMAND BLE (simula la app).
"""
from __future__ import annotations

import argparse
import math
import random
import struct
import sys
import threading
import time

import os

import serial  # pyserial

import ble_cloud
import pet_frames as pf


class Chaos:
    def __init__(self) -> None:
        self.loss = self.dup = self.corrupt = 0.0
        self.delay_ms = 0

    def apply(self, frame: bytes) -> list[bytes]:
        if random.random() < self.loss:
            log("~", "chaos: trama perdida")
            return []
        if random.random() < self.corrupt:
            b = bytearray(frame)
            b[random.randrange(7, len(b))] ^= 0x5A
            frame = bytes(b)
            log("~", "chaos: trama corrompida")
        out = [frame]
        if random.random() < self.dup:
            out.append(frame)
            log("~", "chaos: trama duplicada")
        if self.delay_ms:
            time.sleep(self.delay_ms / 1000)
        return out


_print_lock = threading.Lock()


def log(src: str, msg: str) -> None:
    with _print_lock:
        print(f"{time.strftime('%H:%M:%S')} {src:>6} | {msg}", flush=True)


def open_port(url: str, wait_s: float = 30) -> serial.SerialBase:
    """Abre el puerto; espera hasta `wait_s` a que la simulación levante su servidor RFC2217."""
    deadline = time.time() + wait_s
    while True:
        try:
            return serial.serial_for_url(url, baudrate=115200, bytesize=8, parity="N", stopbits=1, timeout=0.05)
        except serial.SerialException:
            if time.time() >= deadline:
                raise
            time.sleep(1)


class Bridge:
    def __init__(self, args: argparse.Namespace) -> None:
        self.dev_id = int(args.dev_id, 0)
        self.chaos = Chaos()
        self.collar = open_port(args.collar) if args.collar else None
        self.unit = open_port(args.unit) if args.unit else None
        self.cmd_id = 1
        self.ble_id = 0x0100
        self.virtual_seq = 0
        self.virtual_interval = 15
        self.virtual_last_cmd: tuple[int, bytes] | None = None
        self.running = True
        self.unit_lock = threading.Lock()  # consola, collar virtual y celular escriben a la unidad
        self.phone: ble_cloud.FakePhone | None = None
        self.stop = threading.Event()
        if args.cloud:
            self.phone = self.setup_phone(args)

    # --------------------------------------------------------- celular falso ---
    def setup_phone(self, args: argparse.Namespace) -> ble_cloud.FakePhone:
        if not self.unit:
            raise SystemExit("--cloud necesita --unit (la unidad es la que habla BLE)")
        if not args.pair_code:
            raise SystemExit("--cloud necesita --pair-code (el código que muestra el portal)")
        url = os.environ.get("OVENBIRD_URL", ble_cloud.DEFAULT_URL)
        client = ble_cloud.OvenbirdBridgeClient(url, log=lambda m: log("cloud", m))
        name = args.name or "OB-" + args.uid.replace(":", "")[-4:].upper()
        device_id = client.pair(args.pair_code, args.uid, name)
        log("cloud", f"unidad emparejada en Ovenbird: deviceId={device_id} uid={args.uid} nombre={name}")
        return ble_cloud.FakePhone(
            client,
            lambda line: self.write_unit((line + "\n").encode()),
            ack_timeout_s=args.ack_timeout,
            log=lambda m: log("phone", m),
        )

    def write_unit(self, data: bytes) -> None:
        with self.unit_lock:
            self.unit.write(data)

    # ------------------------------------------------------------ lectura ---
    def pump(self, name: str, src: serial.SerialBase, dst: serial.SerialBase | None) -> None:
        parser = pf.StreamParser()
        while self.running:
            try:
                data = src.read(256)
            except serial.SerialException:
                # La simulación terminó (p. ej. límite de 5 min de wokwi-cli en el plan gratis).
                log("bridge", f"se cortó la conexión con {name}; fin del puente")
                self.running = False
                self.stop.set()
                return
            if not data:
                continue
            frames, lines = parser.feed(data)
            for line in lines:
                log(name, line)
                if name == "unit" and self.phone:
                    self.phone.on_unit_line(line)
            for fr in frames:
                try:
                    log(name, pf.describe(pf.decode(fr)))
                except pf.DecodeError as e:
                    log(name, f"trama descartada {e}")
                    continue
                if dst is not None:
                    for out in self.chaos.apply(fr):
                        if dst is self.unit:
                            self.write_unit(out)
                        else:
                            dst.write(out)
                elif name == "unit":
                    self.virtual_collar_rx(fr)

    # ---------------------------------------------------- collar virtual ---
    def virtual_collar_rx(self, fr: bytes) -> None:
        d = pf.decode(fr)
        if d["type"] != pf.T_COMMAND or d["dev_id"] != self.dev_id:
            return
        if self.virtual_last_cmd and self.virtual_last_cmd[0] == d["cmd_id"]:
            self.write_unit(self.virtual_last_cmd[1])  # idempotencia
            return
        result = 0
        if d["code"] == pf.CMD_SET_INTERVAL:
            s = struct.unpack(">H", d["params"])[0] if len(d["params"]) == 2 else 0
            if 5 <= s <= 3600:
                self.virtual_interval = s
            else:
                result = 2
        elif d["code"] not in (pf.CMD_FIND_ME, pf.CMD_REQUEST_TELEMETRY):
            result = 1
        ack = pf.encode_ack(self.dev_id, d["cmd_id"], d["code"], result)
        self.virtual_last_cmd = (d["cmd_id"], ack)
        self.write_unit(ack)
        log("vcollar", pf.describe(pf.decode(ack)))
        if d["code"] == pf.CMD_REQUEST_TELEMETRY and result == 0:
            self.virtual_collar_tx(with_fw=True)

    def virtual_collar_tx(self, with_fw: bool = False) -> None:
        ps = self.virtual_interval >= 100
        flags = 0x02 | (0x08 if ps else 0x04) | (0x10 if self.virtual_seq < 3 else 0)
        t = random.random() * 6.28
        tlvs = [(pf.TLV_G1_POWER, struct.pack(">BH", 1 if ps else 0, self.virtual_interval))]
        if with_fw or self.virtual_seq < 3:
            tlvs.insert(0, (pf.TLV_FW, b"\x01\x00\x00"))
        tel = pf.Telemetry(self.virtual_seq & 0xFFFF, flags, int(-38005500 + 800 * math.sin(t)),
                           int(-57542600 + 800 * math.cos(t)), 80, 1, tlvs)
        self.virtual_seq += 1
        fr = pf.encode_telemetry(self.dev_id, tel)
        log("vcollar", pf.describe(pf.decode(fr)))
        for out in self.chaos.apply(fr):
            self.write_unit(out)

    def virtual_collar_loop(self) -> None:
        nxt = time.time()
        while self.running:
            if time.time() >= nxt:
                self.virtual_collar_tx()
                nxt = time.time() + self.virtual_interval
            time.sleep(0.05)

    # ------------------------------------------------------------ consola ---
    def send_collar_cmd(self, frame: bytes) -> None:
        log("vunit", pf.describe(pf.decode(frame)))
        self.collar.write(frame)
        self.cmd_id = (self.cmd_id % 255) + 1

    def send_ble(self, opcode: int, arg: int) -> None:
        line = f">ble {pf.ble_command(self.ble_id, opcode, arg).hex()}\n"
        self.ble_id += 1
        log("app", line.strip())
        self.write_unit(line.encode())

    def console(self) -> None:
        for raw in sys.stdin:
            parts = raw.strip().split()
            if not parts:
                continue
            cmd, rest = parts[0].lower(), parts[1:]
            try:
                if cmd == "quit":
                    break
                if cmd == "chaos":
                    for kv in rest:
                        k, v = kv.split("=")
                        if k == "delay":
                            self.chaos.delay_ms = int(v)
                        else:
                            setattr(self.chaos, k, float(v))
                    log("chaos", vars(self.chaos))
                    continue
                if cmd == "ble" and self.unit:
                    self.write_unit(f">ble {rest[0]}\n".encode())
                    continue
                if cmd in ("ahorro", "normal"):
                    cmd, rest = "interval", ["150" if cmd == "ahorro" else "15"]
                if self.unit:
                    # Hay unidad: simulamos la app escribiendo COMMAND por BLE.
                    if cmd == "find":
                        self.send_ble(1, int(rest[0]))
                    elif cmd == "interval":
                        self.send_ble(2, int(rest[0]))
                    else:
                        log("err", "con unidad presente solo find/interval/ble")
                elif self.collar:
                    if cmd == "find":
                        self.send_collar_cmd(pf.find_me(self.dev_id, self.cmd_id, int(rest[0])))
                    elif cmd == "interval":
                        self.send_collar_cmd(pf.set_interval(self.dev_id, self.cmd_id, int(rest[0])))
                    elif cmd == "req":
                        self.send_collar_cmd(pf.request_telemetry(self.dev_id, self.cmd_id))
                    else:
                        log("err", f"comando desconocido: {cmd}")
            except (IndexError, ValueError) as e:
                log("err", f"argumentos inválidos: {e}")
        self.running = False
        self.stop.set()

    def run(self) -> None:
        threads = []
        if self.collar:
            threads.append(threading.Thread(target=self.pump, args=("collar", self.collar, self.unit), daemon=True))
        if self.unit:
            threads.append(threading.Thread(target=self.pump, args=("unit", self.unit, self.collar), daemon=True))
        if self.unit and not self.collar:
            threads.append(threading.Thread(target=self.virtual_collar_loop, daemon=True))
        for t in threads:
            t.start()
        if self.phone:
            self.phone.start(self.stop)
        log("bridge", f"listo (DEV_ID=0x{self.dev_id:04X}). Escribí 'find 10', 'ahorro', 'chaos loss=0.2'...")
        # La consola corre aparte: el puente termina con 'quit' o si se corta una simulación.
        threading.Thread(target=self.console, daemon=True).start()
        try:
            while not self.stop.wait(0.5):
                pass
        except KeyboardInterrupt:
            self.running = False


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--collar", help="endpoint serie del collar (ej. rfc2217://localhost:4000)")
    ap.add_argument("--unit", help="endpoint serie de la unidad (ej. rfc2217://localhost:4001)")
    ap.add_argument("--dev-id", default="0x0101", help="DEV_ID usado por la unidad/collar virtual")
    ap.add_argument("--seed", type=int, help="semilla para chaos reproducible")
    ap.add_argument("--cloud", action="store_true", help="activa el celular falso (Ovenbird)")
    ap.add_argument("--pair-code", help="código de emparejamiento que muestra el portal")
    ap.add_argument("--uid", default="02:47:31:00:00:01",
                    help="UID (MAC) de PRUEBA de la unidad simulada; nunca uno real")
    ap.add_argument("--name", help="nombre del dispositivo en Ovenbird (por defecto OB-xxxx)")
    ap.add_argument("--ack-timeout", type=float, default=600,
                    help="segundos sin COMMAND_ACK antes de informar error (ahorro: 3 ventanas de 150 s)")
    args = ap.parse_args()
    if not args.collar and not args.unit:
        ap.error("indicá --collar y/o --unit")
    if args.seed is not None:
        random.seed(args.seed)
    Bridge(args).run()


if __name__ == "__main__":
    main()
