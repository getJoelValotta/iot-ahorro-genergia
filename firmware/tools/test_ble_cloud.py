"""Tests del "celular falso" por sus dos bordes: líneas de consola de la unidad y HTTP de Ovenbird.

python -m pytest firmware/tools -q
"""
from __future__ import annotations

import pytest

import pet_frames as pf
from ble_cloud import CloudError, FakePhone, OvenbirdBridgeClient


class FakeHttp:
    """Ovenbird falso: registra pedidos y responde lo programado (o una respuesta por defecto)."""

    def __init__(self) -> None:
        self.calls: list[tuple[str, str, dict | None, dict]] = []
        self.queue: dict[str, list] = {}
        self.commands: list[dict] = []

    def program(self, path_prefix: str, *responses) -> None:
        self.queue.setdefault(path_prefix, []).extend(responses)

    def __call__(self, method, url, headers, body, timeout):
        path = url.split("ovenbird.test", 1)[1]
        self.calls.append((method, path, body, headers))
        for prefix, pending in self.queue.items():
            if path.startswith(prefix) and pending:
                r = pending.pop(0)
                if isinstance(r, Exception):
                    raise r
                return r
        if path == "/v1/app/pair":
            return 200, {}, {"deviceId": "dev-1", "bridgeToken": "secret-bridge-token"}
        if path == "/v1/ingest":
            return 200, {}, {"accepted": len(body["reports"]), "rejected": []}
        if path.startswith("/v1/bridge/commands?"):
            items, self.commands = self.commands, []
            return 200, {}, {"items": items}
        if path.startswith("/v1/bridge/commands/"):
            return 200, {}, {"status": "acked"}
        return 404, {}, {"error": {"code": "not_found"}}

    def paths(self, method: str | None = None) -> list[str]:
        return [p for m, p, _, _ in self.calls if method is None or m == method]

    def bodies(self, prefix: str) -> list[dict]:
        return [b for _, p, b, _ in self.calls if p.startswith(prefix)]


@pytest.fixture
def http():
    return FakeHttp()


@pytest.fixture
def sleeps():
    return []


@pytest.fixture
def client(http, sleeps):
    return OvenbirdBridgeClient("https://ovenbird.test/", http=http, sleep=sleeps.append)


class Clock:
    def __init__(self) -> None:
        self.t = 1_800_000_000.0

    def __call__(self) -> float:
        return self.t


@pytest.fixture
def phone(client):
    written: list[str] = []
    clock = Clock()
    client.pair("ABC-123", "02:47:31:00:00:01", "OB-0001 (Wokwi)")
    p = FakePhone(client, written.append, clock=clock, ack_timeout_s=600, first_ble_id=0x0100)
    p.written, p.clock = written, clock  # type: ignore[attr-defined]
    return p


def unit_line(name: str, payload: bytes) -> str:
    return f"# BLE {name} {payload.hex().upper()}"


# ------------------------------------------------------------------ emparejamiento ---
def test_pair_envia_codigo_producto_y_uid_sin_auth(client, http):
    device_id = client.pair("ABC-123", "02:47:31:00:00:01", "OB-0001")
    assert device_id == "dev-1"
    method, path, body, headers = http.calls[0]
    assert (method, path) == ("POST", "/v1/app/pair")
    assert body == {"code": "ABC-123", "productId": "ob.lora.unit", "uid": "02:47:31:00:00:01", "name": "OB-0001"}
    assert "Authorization" not in headers


def test_el_token_del_puente_se_usa_como_bearer_y_nunca_aparece_en_repr(client, http):
    client.pair("ABC-123", "02:47:31:00:00:01", "OB")
    client.ingest([{"seq": 1, "ts": 1, "dps": {"battery_pct": 50}}])
    assert http.calls[-1][3]["Authorization"] == "Bearer secret-bridge-token"
    assert "secret-bridge-token" not in repr(client)
    assert "secret-bridge-token" not in str(vars(client).get("_log", ""))


def test_pair_con_codigo_invalido_da_error_claro_sin_reintentar(client, http, sleeps):
    http.program("/v1/app/pair", (404, {}, {"error": {"code": "pairing_code_invalid", "message": "x"}}))
    with pytest.raises(CloudError, match="pairing_code_invalid"):
        client.pair("NOPE", "02:47:31:00:00:01", "OB")
    assert sleeps == []


# ------------------------------------------------------------- reportes (LOCATION/STATUS) ---
def test_location_y_status_se_convierten_en_dps(phone, client, http):
    phone.on_unit_line(unit_line("LOCATION", pf.ble_location(-380005500, -575426000, 120, 3, 0)))
    phone.on_unit_line(unit_line("STATUS", pf.ble_status(80, -61, 9, True, 7, 3)))
    phone.flush()
    (body,) = http.bodies("/v1/ingest")
    reports = body["reports"]
    assert [r["seq"] for r in reports] == [1, 2]
    assert all(r["ts"] == 1_800_000_000 for r in reports)
    assert reports[0]["dps"] == {"location": {"lat": -38.00055, "lon": -57.5426, "fix": "3d", "hdop": 1.2}}
    assert reports[1]["dps"] == {
        "battery_pct": 80,
        "collar_online": True,
        "link_rssi_dbm": -61,
        "link_snr_db": 9,
    }


def test_valores_desconocidos_no_se_reportan(phone, http):
    # bat 255 = desconocida, hdop FFFF = desconocido, fix 0 = sin posición
    phone.on_unit_line(unit_line("STATUS", pf.ble_status(255, -90, -3, False, 1, 0xFFFF)))
    phone.on_unit_line(unit_line("LOCATION", pf.ble_location(0, 0, 0xFFFF, 0, 0)))
    phone.on_unit_line(unit_line("LOCATION", pf.ble_location(-380000000, -575000000, 0xFFFF, 2, 0)))
    phone.flush()
    reports = http.bodies("/v1/ingest")[0]["reports"]
    assert reports[0]["dps"] == {"collar_online": False, "link_rssi_dbm": -90, "link_snr_db": -3}
    assert reports[1]["dps"] == {"location": {"lat": -38.0, "lon": -57.5, "fix": "2d"}}
    assert len(reports) == 2


def test_seq_es_monotonico_entre_envios(phone, http):
    for _ in range(2):
        phone.on_unit_line(unit_line("STATUS", pf.ble_status(50, -70, 5, True, 1, 1)))
        phone.flush()
    seqs = [r["seq"] for b in http.bodies("/v1/ingest") for r in b["reports"]]
    assert seqs == [1, 2]


def test_lineas_que_no_son_ble_o_mal_formadas_se_ignoran(phone, http):
    for line in ["# tel seq=3 fix=2", "# BLE LOCATION zz", "# BLE STATUS 0102", "hola", "# BLE FW_VERSION 1.0.0"]:
        phone.on_unit_line(line)
    phone.flush()
    assert http.bodies("/v1/ingest") == []


# --------------------------------------------------------------- comandos de la nube ---
def test_comando_de_la_nube_va_a_la_unidad_y_el_ack_ok_lo_confirma(phone, http):
    http.commands = [{"commandId": "c1", "dps": {"report_interval_s": 150}, "status": "sent"}]
    phone.poll_once(wait_s=0)
    assert phone.written == [">ble " + pf.ble_command(0x0100, 2, 150).hex()]
    phone.on_unit_line(unit_line("COMMAND_ACK", pf.ble_ack(0x0100, 0)))
    assert http.bodies("/v1/bridge/commands/c1/ack") == [{"result": "ok"}]


def test_find_me_usa_opcode_1(phone, http):
    http.commands = [{"commandId": "c2", "dps": {"find_me": 10}}]
    phone.poll_once(wait_s=0)
    assert phone.written == [">ble " + pf.ble_command(0x0100, 1, 10).hex()]


@pytest.mark.parametrize("result,detail", [(1, "busy"), (2, "unsupported"), (3, "sin respuesta del collar")])
def test_ack_con_error_de_la_unidad_se_informa_como_error(phone, http, result, detail):
    http.commands = [{"commandId": "c3", "dps": {"report_interval_s": 15}}]
    phone.poll_once(wait_s=0)
    phone.on_unit_line(unit_line("COMMAND_ACK", pf.ble_ack(0x0100, result)))
    assert http.bodies("/v1/bridge/commands/c3/ack") == [{"result": "error", "detail": detail}]


def test_sin_ack_de_la_unidad_vence_y_se_informa_error(phone, http):
    http.commands = [{"commandId": "c4", "dps": {"report_interval_s": 150}}]
    phone.poll_once(wait_s=0)
    phone.clock.t += 599
    phone.check_timeouts()
    assert http.bodies("/v1/bridge/commands/c4/ack") == []
    phone.clock.t += 2
    phone.check_timeouts()
    assert http.bodies("/v1/bridge/commands/c4/ack") == [{"result": "error", "detail": "la unidad no respondió"}]
    # Un ACK tardío ya no se reenvía.
    phone.on_unit_line(unit_line("COMMAND_ACK", pf.ble_ack(0x0100, 0)))
    assert len(http.bodies("/v1/bridge/commands/c4/ack")) == 1


def test_comando_con_dp_desconocido_o_fuera_de_rango_se_rechaza_sin_tocar_la_unidad(phone, http):
    http.commands = [
        {"commandId": "c5", "dps": {"led": 1}},
        {"commandId": "c6", "dps": {"report_interval_s": 99999}},
    ]
    phone.poll_once(wait_s=0)
    assert phone.written == []
    assert http.bodies("/v1/bridge/commands/c5/ack")[0]["result"] == "error"
    assert http.bodies("/v1/bridge/commands/c6/ack")[0]["result"] == "error"


def test_comando_repetido_no_se_reenvia_a_la_unidad(phone, http):
    cmd = {"commandId": "c7", "dps": {"find_me": 5}}
    http.commands = [cmd]
    phone.poll_once(wait_s=0)
    http.commands = [cmd]
    phone.poll_once(wait_s=0)
    assert len(phone.written) == 1


def test_ack_de_otro_cmd_id_se_ignora(phone, http):
    http.commands = [{"commandId": "c8", "dps": {"find_me": 5}}]
    phone.poll_once(wait_s=0)
    phone.on_unit_line(unit_line("COMMAND_ACK", pf.ble_ack(0x7777, 0)))
    assert http.bodies("/v1/bridge/commands/c8/ack") == []


# ------------------------------------------------------------------------ reintentos ---
def test_reintenta_con_espera_creciente_ante_red_y_5xx(client, http, sleeps):
    client.pair("ABC-123", "u", "n")
    http.program("/v1/ingest", OSError("red caída"), (503, {}, {}), (502, {}, {}))
    client.ingest([{"seq": 1, "ts": 1, "dps": {"battery_pct": 1}}])
    assert len(http.bodies("/v1/ingest")) == 4
    assert sleeps == sorted(sleeps) and len(sleeps) == 3 and sleeps[0] > 0


def test_respeta_retry_after_del_429(client, http, sleeps):
    client.pair("ABC-123", "u", "n")
    http.program("/v1/ingest", (429, {"Retry-After": "7"}, {}))
    client.ingest([{"seq": 1, "ts": 1, "dps": {"battery_pct": 1}}])
    assert sleeps == [7.0]


def test_errores_4xx_no_se_reintentan(client, http, sleeps):
    client.pair("ABC-123", "u", "n")
    http.program("/v1/ingest", (422, {}, {"error": {"code": "validation_error"}}))
    with pytest.raises(CloudError):
        client.ingest([{"seq": 1, "ts": 1, "dps": {}}])
    assert sleeps == []


def test_si_ovenbird_sigue_caido_los_reportes_se_guardan_para_despues(phone, http):
    http.program("/v1/ingest", *([OSError("caído")] * 10))
    phone.on_unit_line(unit_line("STATUS", pf.ble_status(40, -70, 5, True, 1, 1)))
    phone.flush()  # falla: no se pierde
    http.queue.clear()
    phone.on_unit_line(unit_line("STATUS", pf.ble_status(39, -70, 5, True, 2, 1)))
    phone.flush()
    ok = http.bodies("/v1/ingest")[-1]["reports"]
    assert [r["dps"]["battery_pct"] for r in ok] == [40, 39]
