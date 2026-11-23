"""Vectores del acuerdo + vectores BLE oficiales (python -m pytest firmware/tools)."""
import json
from pathlib import Path

import pytest

import pet_frames as pf

ROOT = Path(__file__).resolve().parents[2]
DEV = 0x0401

SPEC_VECTORS = {
    "tel_base": "AA 55 01 01 17 04 01 00 01 06 FD EF FD 36 FC 85 2A E8 55 00 02 CD 69",
    "tel_nofix": "AA 55 01 01 17 04 01 00 02 04 00 00 00 00 00 00 00 00 54 FF FF C7 DD",
    "tel_reboot": "AA 55 01 01 1C 04 01 00 00 16 FD EF FD 36 FC 85 2A E8 64 00 00 01 03 01 00 00 32 6E",
    "set_interval_15": "AA 55 01 02 0E 04 01 01 01 02 00 0F 11 06",
    "find_me_10": "AA 55 01 02 0D 04 01 02 02 01 0A 2B 7E",
    "find_me_0": "AA 55 01 02 0D 04 01 03 02 01 00 FC 80",
    "request_tel": "AA 55 01 02 0C 04 01 04 03 00 6B CC",
    "ack_find_me": "AA 55 01 03 0C 04 01 02 02 00 52 3C",
}


def h(s: str) -> bytes:
    return bytes.fromhex(s)


def test_crc_check_value():
    assert pf.crc16_ccitt_false(b"123456789") == 0x29B1


@pytest.mark.parametrize("name", SPEC_VECTORS)
def test_spec_vectors_decode(name):
    pf.decode(h(SPEC_VECTORS[name]), DEV)


def test_encoders_match_spec():
    base = pf.Telemetry(1, 0x06, -34603722, -58381592, 85, 2)
    assert pf.encode_telemetry(DEV, base) == h(SPEC_VECTORS["tel_base"])
    assert pf.encode_telemetry(DEV, pf.Telemetry(2, 0x04, 0, 0, 84, 0xFFFF)) == h(SPEC_VECTORS["tel_nofix"])
    reboot = pf.Telemetry(0, 0x16, -34603722, -58381592, 100, 0, [(0x01, b"\x01\x00\x00")])
    assert pf.encode_telemetry(DEV, reboot) == h(SPEC_VECTORS["tel_reboot"])
    assert pf.set_interval(DEV, 1, 15) == h(SPEC_VECTORS["set_interval_15"])
    assert pf.find_me(DEV, 2, 10) == h(SPEC_VECTORS["find_me_10"])
    assert pf.find_me(DEV, 3, 0) == h(SPEC_VECTORS["find_me_0"])
    assert pf.request_telemetry(DEV, 4) == h(SPEC_VECTORS["request_tel"])
    assert pf.encode_ack(DEV, 2, 2, 0) == h(SPEC_VECTORS["ack_find_me"])


def test_stream_parser_resync():
    noise = b"# log\r\n" + b"\xAA\x55\x01\x01\x0C"
    frames, lines = pf.StreamParser().feed(noise + h(SPEC_VECTORS["ack_find_me"]) + h(SPEC_VECTORS["tel_base"]))
    assert frames == [h(SPEC_VECTORS["ack_find_me"]), h(SPEC_VECTORS["tel_base"])]
    assert lines == ["# log"]


def test_ble_vectors_from_ovenbird():
    data = json.loads((ROOT / "docs/vendor/ble-test-vectors.json").read_text())
    for case in data["cases"]:
        f, expected = case["fields"], h(case["hex"].replace(" ", ""))
        ch = case["characteristic"]
        if ch == "LOCATION":
            hdop = 0xFFFF if f["hdop"] is None else round(f["hdop"] * 100)
            got = pf.ble_location(round(f["lat"] * 1e7), round(f["lon"] * 1e7), hdop, f["fix"], f["ts"])
        elif ch == "STATUS":
            bat = 255 if f["battery_pct"] is None else f["battery_pct"]
            got = pf.ble_status(bat, f["link_rssi_dbm"], f["link_snr_db"], f["collar_online"], f["seq"], f["age_s"])
        elif ch == "COMMAND":
            got = pf.ble_command(f["cmd_id"], f["opcode"], f["arg"])
        else:
            got = pf.ble_ack(f["cmd_id"], f["result"])
        assert got == expected, case["id"]
