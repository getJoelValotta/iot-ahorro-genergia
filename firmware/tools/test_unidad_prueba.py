"""Tests de la unidad de prueba (sin placas ni Wokwi), con el Ovenbird falso de test_ble_cloud.

python -m pytest firmware/tools -q
"""
from __future__ import annotations

from ble_cloud import OvenbirdBridgeClient
from test_ble_cloud import FakeHttp
from unidad_prueba import VirtualUnit


def make_unit(**kw):
    http = FakeHttp()
    client = OvenbirdBridgeClient("https://ovenbird.test/", http=http, sleep=lambda s: None)
    client.pair("ABC-123", "02:47:31:00:00:09", "OB-0009 (prueba)")
    clock = {"t": 1_800_000_000.0}
    unit = VirtualUnit(client, clock=lambda: clock["t"], **kw)
    return unit, http, clock


def test_cada_reporte_sube_posicion_bateria_y_en_linea_con_seq_creciente():
    unit, http, clock = make_unit(battery_pct=80)
    unit.report()
    clock["t"] += 15
    unit.report()
    reports = [r for b in http.bodies("/v1/ingest") for r in b["reports"]]
    assert [r["seq"] for r in reports] == [1, 2, 3, 4]
    loc = reports[0]["dps"]["location"]
    assert -39 < loc["lat"] < -37 and -58 < loc["lon"] < -57 and loc["fix"] == "3d"
    assert reports[1]["dps"]["battery_pct"] == 80
    assert reports[1]["dps"]["collar_online"] is True
    assert reports[2]["ts"] == 1_800_000_015
    # La mascota se mueve entre reportes.
    assert reports[2]["dps"]["location"] != loc


def test_cambio_de_modo_se_confirma_y_cambia_el_intervalo():
    unit, http, _ = make_unit()
    http.commands = [{"commandId": "c1", "dps": {"report_interval_s": 150}}]
    unit.poll(wait_s=0)
    assert http.bodies("/v1/bridge/commands/c1/ack") == [{"result": "ok"}]
    assert unit.interval_s == 150


def test_sin_responder_informa_que_el_collar_no_respondio():
    unit, http, _ = make_unit(respond=False)
    http.commands = [{"commandId": "c2", "dps": {"report_interval_s": 150}}]
    unit.poll(wait_s=0)
    assert http.bodies("/v1/bridge/commands/c2/ack") == [
        {"result": "error", "detail": "sin respuesta del collar"}
    ]
    assert unit.interval_s == 15


def test_comando_desconocido_o_fuera_de_rango_se_rechaza():
    unit, http, _ = make_unit()
    http.commands = [
        {"commandId": "c3", "dps": {"led": 1}},
        {"commandId": "c4", "dps": {"report_interval_s": 1}},
    ]
    unit.poll(wait_s=0)
    assert http.bodies("/v1/bridge/commands/c3/ack")[0]["result"] == "error"
    assert http.bodies("/v1/bridge/commands/c4/ack")[0]["result"] == "error"
    assert unit.interval_s == 15
