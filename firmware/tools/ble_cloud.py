"""'Celular falso': reemplaza a la app Ovenbird Smart durante la prueba con Wokwi.

Wokwi no simula BLE, así que la unidad simulada imprime por consola lo que publicaría por BLE
(`# BLE LOCATION/STATUS/COMMAND_ACK <hex>`) y acepta `>ble <hex>` como COMMAND. Este módulo:

  1. empareja la unidad con el código que muestra el front (`POST /v1/app/pair`, sin auth);
  2. sube LOCATION/STATUS como reportes con DPs (`POST /v1/ingest`, Bearer del puente);
  3. recibe comandos de la nube por long-poll (`GET /v1/bridge/commands?wait=`), los pasa a
     la unidad como COMMAND BLE y los confirma con su COMMAND_ACK
     (`POST /v1/bridge/commands/{id}/ack`).

Formatos relevados contra la API real el 2026-11-23 (ver docs/04-wokwi.md): `ts` en segundos,
comandos en `{"items": [{commandId, dps, ...}]}`. El token del puente vive solo en memoria y
nunca se imprime. Lo usa `radiosim_bridge.py --cloud`.
"""
from __future__ import annotations

import json
import random
import struct
import threading
import time
import urllib.error
import urllib.request
from typing import Callable

PRODUCT_ID = "ob.lora.unit"
DEFAULT_URL = "https://iotplatform.ovenbirdconsulting.com.ar"

# Perfil BLE v1 (little-endian), mismos formatos que pet_frames.ble_*.
LOCATION_FMT = "<iiHBBI"  # lat_e7, lon_e7, hdop_x100, fix, reservado, ts
STATUS_FMT = "<BbbBHH"  # battery, rssi, snr, flags, seq, age_s
ACK_FMT = "<HB"  # cmd_id, result
OP_FIND_ME, OP_SET_INTERVAL = 1, 2
BLE_FIX = {2: "2d", 3: "3d"}
ACK_DETAIL = {1: "busy", 2: "unsupported", 3: "sin respuesta del collar"}
# Rangos de los DPs escribibles de ob.lora.unit (docs/02).
WRITABLE = {"report_interval_s": (OP_SET_INTERVAL, 5, 3600), "find_me": (OP_FIND_ME, 0, 60)}

HttpFn = Callable[[str, str, dict, "dict | None", float], "tuple[int, dict, dict | None]"]


class CloudError(Exception):
    """Error de Ovenbird que no conviene reintentar (o reintentos agotados)."""


def urllib_http(method: str, url: str, headers: dict, body: dict | None, timeout: float):
    """Transporte HTTP real (solo biblioteca estándar)."""
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as res:
            raw = res.read()
            return res.status, dict(res.headers), json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            payload = json.loads(raw) if raw else None
        except ValueError:
            payload = None
        return e.code, dict(e.headers or {}), payload


class OvenbirdBridgeClient:
    """Cliente de los endpoints de app/puente. Reintenta red y 5xx con espera creciente y
    respeta `Retry-After` en 429; los demás 4xx se informan sin reintentar."""

    def __init__(
        self,
        base_url: str = DEFAULT_URL,
        http: HttpFn = urllib_http,
        sleep: Callable[[float], None] = time.sleep,
        retries: int = 3,
        log: Callable[[str], None] = lambda _m: None,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self._http = http
        self._sleep = sleep
        self._retries = retries
        self._log = log
        self.__token: str | None = None  # nunca se loguea
        self.device_id: str | None = None

    def __repr__(self) -> str:
        return f"OvenbirdBridgeClient({self.base_url!r}, paired={self.__token is not None})"

    @property
    def paired(self) -> bool:
        return self.__token is not None

    def _request(self, method: str, path: str, body: dict | None = None, auth: bool = True, timeout: float = 15):
        headers = {"Accept": "application/json"}
        if body is not None:
            headers["Content-Type"] = "application/json"
        if auth:
            if not self.__token:
                raise CloudError("la unidad no está emparejada")
            headers["Authorization"] = f"Bearer {self.__token}"
        attempt = 0
        while True:
            try:
                status, res_headers, payload = self._http(method, self.base_url + path, headers, body, timeout)
            except OSError as e:  # red caída, timeout, DNS
                status, res_headers, payload = 0, {}, {"error": {"code": "network_error", "message": type(e).__name__}}
            if 200 <= status < 300:
                return payload
            retryable = status == 0 or status == 429 or status >= 500
            if not retryable or attempt >= self._retries:
                code = ((payload or {}).get("error") or {}).get("code", "error")
                raise CloudError(f"{method} {path.split('?')[0]} -> {status} {code}")
            if status == 429:
                delay = _retry_after(res_headers, default=2.0)
            else:
                delay = min(30.0, 0.5 * 2**attempt)
            self._log(f"{method} {path.split('?')[0]} -> {status or 'sin red'}; reintento en {delay:.1f} s")
            self._sleep(delay)
            attempt += 1

    def pair(self, code: str, uid: str, name: str) -> str:
        res = self._request(
            "POST",
            "/v1/app/pair",
            {"code": code, "productId": PRODUCT_ID, "uid": uid, "name": name},
            auth=False,
        )
        token = (res or {}).get("bridgeToken")
        if not token:
            raise CloudError("respuesta de emparejamiento sin bridgeToken")
        self.__token = token
        self.device_id = res.get("deviceId")
        return self.device_id or ""

    def ingest(self, reports: list[dict]) -> dict:
        return self._request("POST", "/v1/ingest", {"reports": reports}) or {}

    def poll_commands(self, wait_s: int = 25) -> list[dict]:
        res = self._request("GET", f"/v1/bridge/commands?wait={wait_s}", timeout=wait_s + 15)
        items = (res or {}).get("items", res if isinstance(res, list) else [])
        return [c for c in items if isinstance(c, dict) and c.get("commandId")]

    def ack(self, command_id: str, ok: bool, detail: str | None = None) -> None:
        body: dict = {"result": "ok" if ok else "error"}
        if detail:
            body["detail"] = detail
        self._request("POST", f"/v1/bridge/commands/{command_id}/ack", body)


def _retry_after(headers: dict, default: float) -> float:
    for k, v in headers.items():
        if k.lower() == "retry-after":
            try:
                return max(0.0, float(v))
            except ValueError:
                return default
    return default


class FakePhone:
    """Traduce entre la consola BLE de la unidad y Ovenbird (lo que haría Ovenbird Smart)."""

    MAX_BUFFER = 500

    def __init__(
        self,
        client: OvenbirdBridgeClient,
        write_line: Callable[[str], None],
        clock: Callable[[], float] = time.time,
        ack_timeout_s: float = 600,
        first_ble_id: int | None = None,
        log: Callable[[str], None] = lambda _m: None,
    ) -> None:
        self.client = client
        self.write_line = write_line
        self.clock = clock
        self.ack_timeout_s = ack_timeout_s
        self.log = log
        self._lock = threading.Lock()
        self._seq = 0
        self._buffer: list[dict] = []
        self._ble_id = first_ble_id if first_ble_id is not None else random.randrange(0x0100, 0x8000)
        # cloud_id -> {"ble": set(ble_ids), "deadline": t, "error": detail|None}
        self._groups: dict[str, dict] = {}
        self._ble_to_cloud: dict[int, str] = {}
        self._seen: set[str] = set()

    # ---------------------------------------------------------- unidad -> nube ---
    def on_unit_line(self, line: str) -> None:
        text = line.strip()
        if text.startswith("#"):
            text = text[1:].strip()
        parts = text.split()
        if len(parts) != 3 or parts[0] != "BLE":
            return
        name, hexdata = parts[1], parts[2]
        try:
            raw = bytes.fromhex(hexdata)
        except ValueError:
            return
        try:
            if name == "LOCATION" and len(raw) == struct.calcsize(LOCATION_FMT):
                self._queue_report(self._location_dps(raw))
            elif name == "STATUS" and len(raw) == struct.calcsize(STATUS_FMT):
                self._queue_report(self._status_dps(raw))
            elif name == "COMMAND_ACK" and len(raw) == struct.calcsize(ACK_FMT):
                self._on_ack(*struct.unpack(ACK_FMT, raw))
        except CloudError as e:
            self.log(f"error con Ovenbird: {e}")

    @staticmethod
    def _location_dps(raw: bytes) -> dict | None:
        lat, lon, hdop, fix, _r, _ts = struct.unpack(LOCATION_FMT, raw)
        if fix not in BLE_FIX:
            return None  # sin posición: no se reporta location
        loc: dict = {"lat": lat / 1e7, "lon": lon / 1e7, "fix": BLE_FIX[fix]}
        if hdop != 0xFFFF:
            loc["hdop"] = hdop / 100
        return {"location": loc}

    @staticmethod
    def _status_dps(raw: bytes) -> dict:
        bat, rssi, snr, flags, _seq, _age = struct.unpack(STATUS_FMT, raw)
        dps: dict = {}
        if bat <= 100:
            dps["battery_pct"] = bat
        dps["collar_online"] = bool(flags & 0x01)
        dps["link_rssi_dbm"] = rssi
        dps["link_snr_db"] = snr
        return dps

    def _queue_report(self, dps: dict | None) -> None:
        if not dps:
            return
        with self._lock:
            self._seq += 1
            self._buffer.append({"seq": self._seq, "ts": int(self.clock()), "dps": dps})
            del self._buffer[: -self.MAX_BUFFER]

    def flush(self) -> None:
        """Sube lo acumulado. Si Ovenbird está caído, lo guarda para el próximo intento."""
        with self._lock:
            batch = list(self._buffer)
        if not batch:
            return
        try:
            self.client.ingest(batch)
        except CloudError as e:
            self.log(f"no se pudo subir {len(batch)} reporte(s), se reintenta luego: {e}")
            return
        with self._lock:
            del self._buffer[: len(batch)]
        self.log(f"subidos {len(batch)} reporte(s)")

    # ---------------------------------------------------------- nube -> unidad ---
    def poll_once(self, wait_s: int = 25) -> None:
        for cmd in self.client.poll_commands(wait_s):
            self.handle_command(cmd)

    def handle_command(self, cmd: dict) -> None:
        cloud_id = str(cmd["commandId"])
        with self._lock:
            if cloud_id in self._seen:
                return
            self._seen.add(cloud_id)
        dps = cmd.get("dps") or {}
        lines: list[tuple[int, str]] = []
        for dp, value in dps.items():
            spec = WRITABLE.get(dp)
            if spec is None or not isinstance(value, int) or not spec[1] <= value <= spec[2]:
                self.log(f"comando {cloud_id}: {dp}={value!r} no soportado")
                self.client.ack(cloud_id, False, f"{dp} no soportado")
                return
            ble_id = self._next_ble_id()
            payload = struct.pack("<HBH", ble_id, spec[0], value)
            lines.append((ble_id, f">ble {payload.hex()}"))
        if not lines:
            self.client.ack(cloud_id, False, "comando vacío")
            return
        with self._lock:
            self._groups[cloud_id] = {
                "ble": {b for b, _ in lines},
                "deadline": self.clock() + self.ack_timeout_s,
                "error": None,
            }
            for b, _ in lines:
                self._ble_to_cloud[b] = cloud_id
        for _b, line in lines:
            self.log(f"comando {cloud_id} {dps} -> {line}")
            self.write_line(line)

    def _next_ble_id(self) -> int:
        with self._lock:
            ble_id = self._ble_id
            self._ble_id = (self._ble_id + 1) & 0xFFFF
            if self._ble_id == 0xFFFF:  # reservado por la unidad para comandos internos
                self._ble_id = 0x0100
            return ble_id

    def _on_ack(self, ble_id: int, result: int) -> None:
        with self._lock:
            cloud_id = self._ble_to_cloud.pop(ble_id, None)
            group = self._groups.get(cloud_id) if cloud_id else None
            if group is None:
                return
            group["ble"].discard(ble_id)
            if result != 0 and group["error"] is None:
                group["error"] = ACK_DETAIL.get(result, f"resultado {result}")
            done = not group["ble"]
            if done:
                del self._groups[cloud_id]
        if done:
            self.log(f"comando {cloud_id} -> {'ok' if group['error'] is None else group['error']}")
            self.client.ack(cloud_id, group["error"] is None, group["error"])

    def check_timeouts(self) -> None:
        now = self.clock()
        with self._lock:
            expired = [cid for cid, g in self._groups.items() if now > g["deadline"]]
            for cid in expired:
                for b in self._groups[cid]["ble"]:
                    self._ble_to_cloud.pop(b, None)
                del self._groups[cid]
        for cid in expired:
            self.log(f"comando {cid}: la unidad no respondió a tiempo")
            try:
                self.client.ack(cid, False, "la unidad no respondió")
            except CloudError as e:
                self.log(f"no se pudo informar el vencimiento: {e}")

    # ------------------------------------------------------------- bucles ---
    def start(self, stop: threading.Event, wait_s: int = 25) -> list[threading.Thread]:
        """Lanza los hilos de long-poll y de subida/vencimientos."""

        def poll_loop() -> None:
            backoff = 1.0
            while not stop.is_set():
                try:
                    self.poll_once(wait_s)
                    backoff = 1.0
                except CloudError as e:
                    self.log(f"long-poll: {e}; reintento en {backoff:.0f} s")
                    stop.wait(backoff)
                    backoff = min(60.0, backoff * 2)

        def flush_loop() -> None:
            while not stop.is_set():
                self.flush()
                self.check_timeouts()
                stop.wait(1.0)

        threads = [
            threading.Thread(target=poll_loop, name="cloud-poll", daemon=True),
            threading.Thread(target=flush_loop, name="cloud-flush", daemon=True),
        ]
        for t in threads:
            t.start()
        return threads
