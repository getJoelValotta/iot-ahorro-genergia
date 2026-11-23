"""Codec Python de la Interfaz 1 (trama LoRa v1) y del perfil BLE v1.

Espejo de firmware/lib/pet_protocol para herramientas de PC (bridge, sniffer,
tests cruzados). Sin dependencias externas.
"""
from __future__ import annotations

import struct
from dataclasses import dataclass, field

SYNC = b"\xAA\x55"
VER = 0x01
T_TELEMETRY, T_COMMAND, T_ACK = 0x01, 0x02, 0x03
CMD_SET_INTERVAL, CMD_FIND_ME, CMD_REQUEST_TELEMETRY = 0x01, 0x02, 0x03
CMD_NAMES = {1: "SET_INTERVAL", 2: "FIND_ME", 3: "REQUEST_TELEMETRY"}
ACK_NAMES = {0: "OK", 1: "UNSUPPORTED", 2: "INVALID_PARAM", 3: "FAILED"}
TLV_FW, TLV_GPS_Q, TLV_G1_POWER = 0x01, 0x20, 0x10


def crc16_ccitt_false(data: bytes) -> int:
    crc = 0xFFFF
    for b in data:
        crc ^= b << 8
        for _ in range(8):
            crc = ((crc << 1) ^ 0x1021) & 0xFFFF if crc & 0x8000 else (crc << 1) & 0xFFFF
    return crc


def _finish(body: bytes) -> bytes:
    """body = todo menos el CRC, con LEN ya puesto."""
    return body + struct.pack(">H", crc16_ccitt_false(body[2:]))


def _header(ftype: int, length: int, dev_id: int) -> bytes:
    return SYNC + bytes([VER, ftype, length]) + struct.pack(">H", dev_id)


@dataclass
class Telemetry:
    seq: int
    flags: int
    lat_e6: int
    lon_e6: int
    battery: int
    fix_age: int
    tlvs: list[tuple[int, bytes]] = field(default_factory=list)

    @property
    def fix(self) -> int:
        return self.flags & 0x03


def encode_telemetry(dev_id: int, t: Telemetry) -> bytes:
    tlv = b"".join(bytes([k, len(v)]) + v for k, v in t.tlvs)
    length = 23 + len(tlv)
    body = _header(T_TELEMETRY, length, dev_id) + struct.pack(
        ">HBiiBH", t.seq, t.flags, t.lat_e6, t.lon_e6, t.battery, t.fix_age) + tlv
    return _finish(body)


def encode_command(dev_id: int, cmd_id: int, code: int, params: bytes = b"") -> bytes:
    return _finish(_header(T_COMMAND, 12 + len(params), dev_id) + bytes([cmd_id, code, len(params)]) + params)


def encode_ack(dev_id: int, cmd_id: int, code: int, result: int) -> bytes:
    return _finish(_header(T_ACK, 12, dev_id) + bytes([cmd_id, code, result]))


def set_interval(dev_id: int, cmd_id: int, seconds: int) -> bytes:
    return encode_command(dev_id, cmd_id, CMD_SET_INTERVAL, struct.pack(">H", seconds))


def find_me(dev_id: int, cmd_id: int, seconds: int) -> bytes:
    return encode_command(dev_id, cmd_id, CMD_FIND_ME, bytes([seconds]))


def request_telemetry(dev_id: int, cmd_id: int) -> bytes:
    return encode_command(dev_id, cmd_id, CMD_REQUEST_TELEMETRY)


class DecodeError(ValueError):
    pass


def decode(frame: bytes, expected_dev_id: int | None = None) -> dict:
    """Valida en el orden estricto del acuerdo (§2) y devuelve un dict."""
    if len(frame) < 2 or frame[:2] != SYNC:
        raise DecodeError("BAD_SYNC")
    if len(frame) < 3 or frame[2] != VER:
        raise DecodeError("BAD_VERSION")
    if not (12 <= len(frame) <= 64) or frame[4] != len(frame):
        raise DecodeError("BAD_LENGTH")
    n = len(frame)
    if crc16_ccitt_false(frame[2:n - 2]) != struct.unpack(">H", frame[n - 2:])[0]:
        raise DecodeError("BAD_CRC")
    ftype = frame[3]
    if ftype not in (T_TELEMETRY, T_COMMAND, T_ACK):
        raise DecodeError("UNKNOWN_TYPE")
    dev_id = struct.unpack(">H", frame[5:7])[0]
    if expected_dev_id is not None and dev_id != expected_dev_id:
        raise DecodeError("WRONG_DEVICE")
    out: dict = {"type": ftype, "dev_id": dev_id}
    if ftype == T_TELEMETRY:
        if n < 23:
            raise DecodeError("BAD_BODY")
        seq, flags, lat, lon, bat, age = struct.unpack(">HBiiBH", frame[7:21])
        tlvs, pos, end = [], 21, n - 2
        while pos < end:
            if pos + 2 > end or pos + 2 + frame[pos + 1] > end:
                raise DecodeError("BAD_BODY")
            k, ln = frame[pos], frame[pos + 1]
            tlvs.append((k, bytes(frame[pos + 2:pos + 2 + ln])))
            pos += 2 + ln
        out["telemetry"] = Telemetry(seq, flags, lat, lon, bat, age, tlvs)
    elif ftype == T_COMMAND:
        plen = frame[9]
        if n != 12 + plen:
            raise DecodeError("BAD_BODY")
        out.update(cmd_id=frame[7], code=frame[8], params=bytes(frame[10:10 + plen]))
    else:
        if n != 12:
            raise DecodeError("BAD_BODY")
        out.update(cmd_id=frame[7], code=frame[8], result=frame[9])
    return out


def describe(d: dict) -> str:
    if d["type"] == T_TELEMETRY:
        t: Telemetry = d["telemetry"]
        f = t.flags
        flags = []
        if f & 0x04: flags.append("ESCUCHA")
        if f & 0x08: flags.append("AHORRO")
        if f & 0x10: flags.append("REINICIO")
        extra = []
        for k, v in t.tlvs:
            if k == TLV_FW and len(v) == 3:
                extra.append(f"fw={v[0]}.{v[1]}.{v[2]}")
            elif k == TLV_GPS_Q and len(v) == 3:
                extra.append(f"sats={v[0]} hdop={struct.unpack('>H', v[1:])[0] / 100:.2f}")
            elif k == TLV_G1_POWER and len(v) == 3:
                extra.append(f"g1_modo={'ahorro' if v[0] else 'normal'} I={struct.unpack('>H', v[1:])[0]}s")
            else:
                extra.append(f"tlv0x{k:02X}={v.hex()}")
        return (f"TEL dev=0x{d['dev_id']:04X} seq={t.seq} fix={t.fix} [{'|'.join(flags)}] "
                f"lat={t.lat_e6 / 1e6:.6f} lon={t.lon_e6 / 1e6:.6f} bat={t.battery} "
                f"age={t.fix_age} {' '.join(extra)}")
    if d["type"] == T_COMMAND:
        return (f"CMD dev=0x{d['dev_id']:04X} id={d['cmd_id']} {CMD_NAMES.get(d['code'], hex(d['code']))} "
                f"params={d['params'].hex()}")
    return (f"ACK dev=0x{d['dev_id']:04X} id={d['cmd_id']} {CMD_NAMES.get(d['code'], hex(d['code']))} "
            f"-> {ACK_NAMES.get(d['result'], d['result'])}")


class StreamParser:
    """Re-sincronización AA 55 sobre un flujo (mismo algoritmo que el firmware).

    Además separa las líneas de texto ASCII (logs '# ...') para mostrarlas.
    """

    def __init__(self) -> None:
        self.buf = bytearray()
        self.text = bytearray()

    def feed(self, data: bytes) -> tuple[list[bytes], list[str]]:
        frames: list[bytes] = []
        lines: list[str] = []
        self.buf.extend(data)
        while self.buf:
            if self.buf[0] != 0xAA:
                c = self.buf.pop(0)
                if c in (0x0A, 0x0D):
                    if self.text:
                        lines.append(self.text.decode("ascii", "replace"))
                        self.text.clear()
                elif 0x20 <= c < 0x7F:
                    self.text.append(c)
                continue
            if len(self.buf) < 5:
                break
            if self.buf[1] != 0x55 or self.buf[2] != VER or not (12 <= self.buf[4] <= 64):
                self.buf.pop(0)
                continue
            n = self.buf[4]
            if len(self.buf) < n:
                break
            cand = bytes(self.buf[:n])
            if crc16_ccitt_false(cand[2:n - 2]) == struct.unpack(">H", cand[n - 2:])[0]:
                frames.append(cand)
                del self.buf[:n]
            else:
                self.buf.pop(0)
        return frames, lines


# ---------------------------------------------------------------- BLE v1 -----
# Formatos del perfil BLE v1 de Ovenbird (little-endian). Única definición: ble_cloud.py los reusa.
BLE_LOCATION_FMT = "<iiHBBI"  # lat_e7, lon_e7, hdop_x100, fix, reservado, ts
BLE_STATUS_FMT = "<BbbBHH"  # battery, rssi, snr, flags, seq, age_s
BLE_COMMAND_FMT = "<HBH"  # cmd_id, opcode, arg
BLE_ACK_FMT = "<HB"  # cmd_id, result


def ble_location(lat_e7: int, lon_e7: int, hdop_x100: int, fix: int, ts: int) -> bytes:
    if fix == 0:
        lat_e7 = lon_e7 = 0
    return struct.pack(BLE_LOCATION_FMT, lat_e7, lon_e7, hdop_x100, fix, 0, ts)


def ble_status(bat: int, rssi: int, snr: int, online: bool, seq: int, age_s: int) -> bytes:
    return struct.pack(BLE_STATUS_FMT, bat, rssi, snr, 1 if online else 0, seq, age_s)


def ble_command(cmd_id: int, opcode: int, arg: int) -> bytes:
    return struct.pack(BLE_COMMAND_FMT, cmd_id, opcode, arg)


def ble_ack(cmd_id: int, result: int) -> bytes:
    return struct.pack(BLE_ACK_FMT, cmd_id, result)
