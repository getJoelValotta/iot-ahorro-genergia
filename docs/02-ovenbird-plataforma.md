# Ovenbird IoT Cloud — lo que sabemos (relevado el 2026-11-23)

Portal: https://iotplatform.ovenbirdconsulting.com.ar · API ref: `/docs` · OpenAPI: `/openapi.json`
Docs: `/plataforma/{inicio,proyecto,virtual,emparejamiento,ble,mqtt,node,react,api,productos,errores}`

> Estas notas salen de leer las páginas de docs. Varios detalles (tipos de respuesta del SDK,
> props de componentes React) **no están documentados en la web**: la fuente de verdad son los
> `.d.ts` dentro de los tarballs del SDK. Después de `scripts/setup`, leer
> `vendor/` y `node_modules/@ovenbird/*/dist/*.d.ts` antes de escribir código contra el SDK.

## Descargas (no están en npm público)

| Recurso | URL |
| --- | --- |
| SDK Node | `/descargas/ovenbird-node-1.0.0.tgz` (Node ≥ 20, ESM + CJS) |
| SDK React | `/descargas/ovenbird-react-1.0.0.tgz` |
| Vectores BLE | `/descargas/ble-test-vectors.json` (copia en `docs/vendor/`) |
| Header BLE | `/descargas/ble_profile.h` |
| App Android | `/descargas/ovenbird-smart.apk` (v1.0.4, tiene modo simulado) |

`scripts/setup.ps1` / `scripts/setup.sh` descargan todo en `vendor/`.

## Proyecto, credenciales y tenant

- Se crea con cuenta en `/cuenta` → proyecto con datos de persona/empresa y **1..10 orígenes**
  (`http(s)://host[:port]`, sin path ni query). Devuelve `clientId` + `clientSecret`
  (**el secret se muestra una sola vez**).
- Colaboradores: `POST /v1/account/tenants/:id/invites` por email.
- Token servidor: `POST /v1/auth/token { grantType: "client_credentials", clientId, clientSecret }`
  → `{ accessToken, tokenType: "Bearer", expiresIn: 3600 }`. El SDK lo maneja solo.
- Si un browser manda `Origin`, debe estar en los orígenes del proyecto (por eso hay que cargar
  `http://localhost:3000` y los de otros grupos para pruebas cruzadas).
- Env vars: `OVENBIRD_URL`, `OVENBIRD_CLIENT_ID`, `OVENBIRD_CLIENT_SECRET` (solo backend),
  `NEXT_PUBLIC_OVENBIRD_URL` (frontend).

## SDK `@ovenbird/node`

```ts
import { OvenbirdClient } from '@ovenbird/node';
const ob = new OvenbirdClient({ baseUrl, clientId, clientSecret });
const page = await ob.devices.list({ limit: 50 });          // page.items[].deviceId
const status = await ob.devices.status(page.items[0].deviceId);
```
NestJS: `import { OvenbirdModule } from '@ovenbird/node/nest'` → `OvenbirdModule.forRoot({...})`
(también `forRootAsync`) provee `OvenbirdService`.

| Método | Uso |
| --- | --- |
| `devices.list / get / update / remove` | gestión |
| `devices.status / history` | estado actual; `history` **requiere `dp`** |
| `commands.send / get / waitForAck` | comandos (`POST /v1/devices/{id}/commands { dps, ttlS? }`) |
| `events.subscribe` | SSE de reportes/conexión/comandos, reanuda con `Last-Event-ID` |
| `pairing.createCode({ label })` | código de un solo uso, vence a los 10 min |
| `embed.createToken` | token para el front, 1..50 dispositivos, `ttlS` máx 3600 |

Reintentos: renueva sesión en 401; reintenta red/429/5xx; no reintenta validación.

Errores (`/plataforma/errores`): `OvenbirdError {status, code, message, details}`,
`OvenbirdAuthError` 401, `OvenbirdNotFoundError` 404 (inexistente o fuera de scope),
`OvenbirdValidationError` 422 (DP no corresponde al producto), `OvenbirdRateLimitError` 429
(`retryAfterMs`). `commands.waitForAck` lanza si el comando pasa a `failed`/`expired` o timeout.

## SDK `@ovenbird/react`

```tsx
'use client';
import { DeviceMap, OvenbirdProvider, useDevices } from '@ovenbird/react';
<OvenbirdProvider baseUrl={process.env.NEXT_PUBLIC_OVENBIRD_URL}
  getToken={async () => (await (await fetch('/api/ovenbird/embed-token')).json()).token}>
```
- `getToken` se vuelve a llamar ante 401. En nuestro caso apunta al backend: `POST /api/v1/embed-token`.
- Hooks/componentes: `useDevices`, `useDeviceStatus`, `useDeviceHistory`, `DeviceMap` (omite
  posiciones sin fix), `OnlineBadge`, `BatteryIndicator`, `ProximityGauge`, `DeviceCard`.
- Next.js: `'use client'` y agregar el paquete a `transpilePackages`.

## Producto `ob.lora.unit` (DPs)

- Reporta: `location {lat, lon, hdop?, fix? none|2d|3d}`, `battery_pct`, `link_rssi_dbm`,
  `link_snr_db`, `collar_online`, `fw_version`.
- Escribibles: `report_interval_s` (5–3600), `find_me` (0–60).
- Catálogo cerrado; un reporte puede traer solo algunos DPs.

## Emparejamiento

1. Backend: `ob.pairing.createCode({ label })` → `code` (10 min, un solo uso).
2. App Ovenbird Smart: `POST /v1/app/pair { code, productId: "ob.lora.unit", uid, name }`
   → `{ deviceId, bridgeToken, ... }`. Re-emparejar el mismo UID conserva tokens;
   UID de otro producto → `product_mismatch`.
3. La app (bridge) sube datos con `POST /v1/ingest` y confirma comandos.

**Dispositivo virtual:** uno por proyecto, `POST /v1/account/tenants/:id/virtual-device`
(desde la consola web). Confirma comandos al instante. Sirve para probar backend+front sin placa.

## Perfil BLE v1 (unidad ↔ app) — LITTLE-endian

Servicio `6f76656e-6269-7264-0001-000000000000`; características `6f76656e-6269-7264-XXXX-000000000000`:

| XXXX | Nombre | Props | Formato |
| --- | --- | --- | --- |
| 0002 | PRODUCT_ID | read | UTF-8 `ob.lora.unit` |
| 0003 | DEVICE_UID | read | 6 bytes, MAC en orden de impresión |
| 0004 | PROTO_VERSION | read | u8 = 1 |
| 0005 | FW_VERSION | read | UTF-8 ≤ 16 |
| 0010 | LOCATION | read+notify | 16 B: `i32 lat_e7, i32 lon_e7, u16 hdop_x100 (FFFF=?), u8 fix (0/2/3), u8 0, u32 ts (0=?)` |
| 0011 | STATUS | read+notify | 8 B: `u8 battery (255=?), i8 rssi, i8 snr, u8 flags (b0=collar_online), u16 seq, u16 age_s` |
| 0020 | COMMAND | write | 5 B: `u16 cmd_id, u8 opcode (1=find_me, 2=set_interval), u16 arg` |
| 0021 | COMMAND_ACK | notify | 3 B: `u16 cmd_id, u8 result (0 ok, 1 busy, 2 unsupported, 3 sin respuesta)` |

Advertising `OB-` + últimos 4 hex del UID, incluye el UUID de servicio, 100–500 ms. Un solo
central. Al conectar la app lee las 4 fijas y se suscribe a LOCATION/STATUS/ACK; la unidad
manda enseguida el último valor. El enlace LoRa sigue sin teléfono.

### ⚠️ Diferencias con el acuerdo entre grupos (docs/01)

- El acuerdo habla de características `INFO/STATUS/CMD/ACK`: **las reales son las de arriba**.
- LoRa usa lat/lon × 10⁶ big-endian; BLE usa × 10⁷ little-endian (convertir en la unidad).
- Opcodes BLE (1 find_me, 2 set_interval) ≠ CMD_CODE LoRa (0x02 FIND_ME, 0x01 SET_INTERVAL).
- FIX LoRa (0/1/2) ≠ fix BLE (0/2/3).
- BLE no tiene "invalid param": decidimos mapear `INVALID_PARAM → 2 unsupported`, `FAILED → 3`.
- La trama LoRa no trae hora → `LOCATION.ts = 0` (desconocido).
Todo esto ya está implementado y testeado en `firmware/lib/pet_protocol/` (`ble_codec`, `unit_logic`).

## OpenAPI (43 operaciones, sin schemas de respuesta)

Relevantes para el backend (todas vía SDK, nunca fetch directo): `/v1/devices[/{id}[/status|/history|/commands]]`,
`/v1/commands/{id}`, `/v1/pairing/codes`, `/v1/embed/tokens`, `/v1/events/stream` (SSE),
`/v1/webhooks`. El front usa `/v1/embed/*` solo a través de `@ovenbird/react`.
