# Especificación Completa y Exhaustiva de Interoperabilidad (Todos los Grupos — TP Final IoT)

**Propósito:** Definir de forma única, cerrada y verificable las dos fronteras de interoperabilidad del sistema para que el **Collar**, la **Unidad**, el **Backend (NestJS)** y el **Frontend (Next.js)** de cualquier grupo (Grupos 1 al 8) puedan intercambiarse y funcionar entre sí sin cambios de código, cambiando únicamente configuración (`.env` / `DEV_ID`).

---

## Resumen Ejecutivo: ¿Qué compartimos todos vs. qué es propio de cada grupo?

| Capa | Qué debe ser **100% IDÉNTICO** en los 8 grupos | Qué es **PROPIO** de cada grupo |
| --- | --- | --- |
| **Interfaz 1: Collar ↔ Unidad (LoRa / `RadioSim`)** | Parámetros LoRa 433.175 MHz, `RadioSim` `115200 8N1`, trama binaria `AA 55`, `VER=0x01`, `DEV_ID`, `CRC-16/CCITT-FALSE`, Telemetría `0x01` (`LAT/LON × 10⁶`), `CMD 0x01..0x03`, `ACK 0x03`, ventana RX `500 ms` y criterio `collar_online`. | Lógica interna de su variante (ej. algoritmo de ahorro, UI en OLED, geocercas, buzzer). TLVs `0xN0..0xNF` o comandos `0xN0..0xNF` propios (que otros grupos ignoran/responden `UNSUPPORTED`). |
| **Interfaz 1b: Unidad ↔ Ovenbird Cloud (BLE v1)** | Servicio GATT `ob.lora.unit`, características `INFO/STATUS/CMD/ACK`, DPs de lectura (`location`, `battery_pct`, `collar_online`, `fw_version`, `link_*`) y DPs de escritura cerrados (`report_interval_s`, `find_me`). | Nada extra: Ovenbird Cloud fija el perfil BLE v1 de forma cerrada. |
| **Interfaz 2: Backend ↔ Frontend (REST `/api/v1`)** | Prefijo `/api/v1`, CORS, `ValidationPipe` tolerante, errores RFC 9457, modelos base (`AuthToken`, `User`, `Pet`, `Device`), paginación `{ data, meta }`, `GET /capabilities` y las **14 rutas comunes obligatorias**. | Endpoints propios de la variante (anunciados por `GET /api/v1/capabilities` y ocultados automáticamente por frontends ajenos) + pantallas propias en su frontend. |

---

# PARTE I — INTERFAZ 1: Protocolo Collar ↔ Unidad (v1)

## 1. Parámetros físicos LoRa (433 MHz) y `RadioSim`

Todos los grupos deben configurar exactamente estos parámetros en `RadioLoRa`:

| Parámetro | Valor obligatorio |
| --- | --- |
| Frecuencia | `433.175 MHz` |
| Ancho de banda (BW) | `125 kHz` |
| Spreading Factor (SF) | `SF7` |
| Coding Rate (CR) | `4/5` |
| Sync word | `0x12` |
| Potencia TX | `14 dBm` |
| Preámbulo | `8` símbolos |
| CRC de capa física | **Activado obligatoriamente** (`LoRa.enableCrc()`) |

### Transporte en simulación (`RadioSim`)
Para poder conectar el Collar simulado del Grupo A con la Unidad simulada del Grupo B:
- **Puerto serie:** `115200 bps`, `8N1`, enviando los **bytes crudos** de la trama binaria (sin encabezados texto ni JSON).
- **Re-sincronización en flujo serie:** el receptor busca `SYNC = AA 55`, lee `LEN` (offset `4`), valida `12 ≤ LEN ≤ 64`, lee hasta completar `LEN` bytes y verifica `CRC-16`. Si falla el CRC, descarta el primer byte (`0xAA`) y vuelve a buscar `AA 55` (evita falsos `AA 55` dentro del payload).

---

## 2. Reglas generales, `DEV_ID` y orden de validación

- **Endianness:** **big-endian** en todos los campos multibyte (`u16`, `i32`).
- **Tamaño máximo de trama:** `64` bytes (`12 ≤ LEN ≤ 64`).
- **GPS / NMEA:** el Collar parsea NMEA internamente (ej. `TinyGPS++`) y transmite solo latitud/longitud binaria escalada. Nunca viaja NMEA por LoRa.
- **Esquema de `DEV_ID (u16)`:** `(numero_grupo << 8) | numero_collar` (ej. Grupo 7 collar 1 = `0x0701`, Grupo 4 collar 1 = `0x0401`). No existe broadcast (`0xFFFF`). Tanto el Collar como la Unidad leen su `DEV_ID` desde configuración (nunca hardcodeado en la lógica).
- **Orden estricto de validación al recibir una trama** (descartar al primer fallo):
  1. `SYNC == 0xAA 0x55`
  2. `VER == 0x01`
  3. `LEN == bytes_recibidos` y `12 ≤ LEN ≤ 64`
  4. `CRC-16/CCITT-FALSE` válido sobre los bytes `[2 .. LEN-3]`
  5. `TYPE` conocido (`0x01`, `0x02` o `0x03`)
  6. `DEV_ID` coincide con el propio (en Collar) o el vinculado (en Unidad)
  7. Largo mínimo válido para `TYPE` y TLVs / `PLEN` estrictamente dentro de `LEN - 2`.

---

## 3. Formato de trama binaria

### 3.1 Encabezado común (7 bytes) + CRC final (2 bytes)

| Offset | Campo | Tipo | Descripción |
| --- | --- | --- | --- |
| `0–1` | `SYNC` | `u8[2]` | `0xAA 0x55` |
| `2` | `VER` | `u8` | `0x01` |
| `3` | `TYPE` | `u8` | `0x01` Telemetría · `0x02` Comando · `0x03` Confirmación (`ACK`) |
| `4` | `LEN` | `u8` | Largo total de la trama en bytes (incluye `SYNC` y `CRC`) |
| `5–6` | `DEV_ID` | `u16` | ID del collar (origen en `0x01`/`0x03`, destino en `0x02`) |
| `7 .. LEN-3` | `BODY` | — | Cuerpo según `TYPE` |
| `LEN-2 .. LEN-1` | `CRC` | `u16` | `CRC-16/CCITT-FALSE` (polinomio `0x1021`, init `0xFFFF`, sin reflexión ni XOR final) sobre `[2 .. LEN-3]`. Test vector: `CRC("123456789") = 0x29B1`. |

### 3.2 Telemetría — `TYPE 0x01` (Collar → Unidad) — Base `23` bytes + TLVs

| Offset | Campo | Tipo | Descripción |
| --- | --- | --- | --- |
| `7–8` | `SEQ` | `u16` | Secuencia incremental del collar (`0..65535`, wrap-around). |
| `9` | `FLAGS` | `u8` | Bits: `0–1` `FIX` (`0=none`, `1=2D`, `2=3D`), `2` `ESCUCHA_CONTINUA` (`1=siempre RX`, `0=solo ventana post-TX`), `3` `MODO_AHORRO`, `4` `REINICIO` (`1` en las primeras 3 tramas tras reset), `5–7` reservados (`0`). |
| `10–13` | `LAT` | `i32` | Latitud en grados × `10⁶` (`0` si `FIX = 0`). |
| `14–17` | `LON` | `i32` | Longitud en grados × `10⁶` (`0` si `FIX = 0`). |
| `18` | `BAT` | `u8` | Batería `0–100` % (`0xFF` = desconocida). |
| `19–20` | `FIX_AGE` | `u16` | Segundos desde el último fix (`0xFFFF` = nunca / ≥ 65535 s). |
| `21 .. LEN-3` | `TLV...` | — | Extensiones opcionales `[T: u8][L: u8][V: u8 × L]`. Si se desconoce `T`, se saltan `L` bytes. |

**TLVs comunes: (tipo - largo-valor)**
- `T = 0x01`, `L = 3`: `FW_VERSION` (`major: u8, minor: u8, patch: u8`). Obligatorio cuando `REINICIO = 1` y en respuesta a `REQUEST_TELEMETRY`.
- `T = 0x20`, `L = 3`: `GPS_QUALITY` (`sats: u8, hdop_x100: u16`, `0xFFFF` = desconocido).
- Rangos `0xN0–0xNF`: reservados para extensiones exclusivas del Grupo `N` (ej. Grupo 7: `0x70–0x7F`).

### 3.3 Comando — `TYPE 0x02` (Unidad → Collar) — Largo `12 + PLEN(parametros len)` bytes

| Offset | Campo | Tipo | Descripción |
| --- | --- | --- | --- |
| `7` | `CMD_ID` | `u8` | Secuencial asignado por la Unidad (las retransmisiones repiten el mismo `CMD_ID`). |
| `8` | `CMD_CODE` | `u8` | Código del comando. |
| `9` | `PLEN` | `u8` | Largo de `PARAMS` (`LEN == 12 + PLEN`). |
| `10 .. 10+PLEN-1` | `PARAMS` | `u8[PLEN]` | Parámetros en big-endian. |

### 3.4 Confirmación (`ACK`) — `TYPE 0x03` (Collar → Unidad) — Largo fijo `12` bytes

| Offset | Campo | Tipo | Descripción |
| --- | --- | --- | --- |
| `7` | `CMD_ID` | `u8` | `CMD_ID` confirmado. |
| `8` | `CMD_CODE` | `u8` | `CMD_CODE` confirmado. |
| `9` | `RESULT` | `u8` | `0x00 OK` · `0x01 UNSUPPORTED` · `0x02 INVALID_PARAM` · `0x03 FAILED`. |

### 3.5 Catálogo común obligatorio de comandos

| `CMD_CODE` | Nombre | Origen Ovenbird (DP) | `PLEN` | Parámetros | Comportamiento obligatorio en todo Collar |
| --- | --- | --- | --- | --- | --- |
| `0x01` | `SET_INTERVAL` | `report_interval_s` | `2` | `u16` seg (`5–3600`) | Ajusta intervalo de reporte (`<5` o `>3600` → `ACK INVALID_PARAM`). Si el collar soporta modo ahorro (G1), se activa con `≥ 100 s` y se desactiva con `< 100 s`. |
| `0x02` | `FIND_ME` | `find_me` | `1` | `u8` seg (`0–60`) | Activa buzzer/LED por `N` s (`0` = apaga). Responde `ACK OK` **al iniciar**. Auto-apagado local obligatorio al vencer `N` s. |
| `0x03` | `REQUEST_TELEMETRY` | Unidad (arranque / BLE) | `0` | — | Responde `ACK OK` y envía telemetría inmediata incluyendo TLV `0x01 FW_VERSION`. |

---

## 4. Reglas temporales, idempotencia y puente BLE (Unidad ↔ Ovenbird)

1. **Ventana RX y cola de comandos en la Unidad:**
   - Si `ESCUCHA_CONTINUA = 1`: la Unidad transmite de inmediato y reintenta hasta `3` veces cada `1 s` con el mismo `CMD_ID`.
   - Si `ESCUCHA_CONTINUA = 0`: el Collar abre ventana RX de **`500 ms`** inmediatamente tras transmitir telemetría (extiende `500 ms` por cada comando recibido). La Unidad encola hasta ≥ `4` comandos y envía dentro de los **`100 ms`** posteriores a recibir telemetría.
2. **Idempotencia en el Collar:** memoriza el último `(CMD_ID, CMD_CODE, RESULT)`; si recibe el mismo `CMD_ID`, no re-ejecuta y reenvía el `ACK`.
3. **Duplicados y reinicios en la Unidad:** descarta telemetrías con `SEQ` igual a alguno de los últimos `4` válidos; si `REINICIO = 1`, limpia su historial de `SEQ`.
4. **Secuencia hacia BLE (`STATUS.seq`):** la Unidad mantiene su propio contador monotónico hacia Ovenbird (no reenvía el `SEQ` crudo del collar para evitar que un reinicio del collar haga que Ovenbird descarte paquetes).
5. **Criterio común de `collar_online`:**
   - `true` al recibir telemetría o `ACK` válido.
   - `false` si pasan `T_offline = max(2 × I + 30 s, 60 s)` sin tramas válidas (o `60 s` normal / `360 s` ahorro si aún no conoce `I`).

### Vectores de prueba verificados (`CRC-16/CCITT-FALSE`)

| Caso | Trama hexadecimal (`DEV_ID 0x0401`) |
| --- | --- |
| Telemetría base (`SEQ 1`, fix 3D + escucha `0x06`, bat `85%`, `FIX_AGE 2s`) | `AA 55 01 01 17 04 01 00 01 06 FD EF FD 36 FC 85 2A E8 55 00 02 CD 69` |
| Telemetría sin fix (`SEQ 2`, `FLAGS 0x04`, bat `84%`, `FIX_AGE 0xFFFF`) | `AA 55 01 01 17 04 01 00 02 04 00 00 00 00 00 00 00 00 54 FF FF C7 DD` |
| Telemetría reinicio + `FW_VERSION 1.0.0` (`SEQ 0`, `FLAGS 0x16`) | `AA 55 01 01 1C 04 01 00 00 16 FD EF FD 36 FC 85 2A E8 64 00 00 01 03 01 00 00 32 6E` |
| `SET_INTERVAL 15 s` (`CMD_ID 1`) | `AA 55 01 02 0E 04 01 01 01 02 00 0F 11 06` |
| `FIND_ME 10 s` (`CMD_ID 2`) | `AA 55 01 02 0D 04 01 02 02 01 0A 2B 7E` |
| `FIND_ME 0 s` (`CMD_ID 3`) | `AA 55 01 02 0D 04 01 03 02 01 00 FC 80` |
| `REQUEST_TELEMETRY` (`CMD_ID 4`) | `AA 55 01 02 0C 04 01 04 03 00 6B CC` |
| `ACK OK` de `FIND_ME` (`CMD_ID 2`) | `AA 55 01 03 0C 04 01 02 02 00 52 3C` |

---

# PARTE II — INTERFAZ 2: Contrato REST Backend ↔ Frontend (v1)

## 5. Reglas globales obligatorias para todos los Backends y Frontends

| Aspecto | Regla obligatoria |
| --- | --- |
| **Prefijo base** | `/api/v1` |
| **Formato** | `application/json`, nombres en inglés `camelCase`. |
| **IDs y fechas** | IDs siempre `string` · Fechas ISO 8601 en UTC (`Z`). |
| **Autenticación** | `Authorization: Bearer <accessToken>` (JWT emitido por el backend). |
| **Paginación** | Query `?page=1&limit=20` (`limit` `1..100`) → `{ data: [...], meta: { page, limit, total } }`. |
| **Errores (RFC 9457)** | `Content-Type: application/problem+json` con `{ type, title, status, detail, code, errors? }`. |
| **CORS y ValidationPipe (NestJS)** | `app.enableCors()` + `new ValidationPipe({ whitelist: true, forbidNonWhitelisted: false, transform: true })`. |
| **Swagger / OpenAPI** | Expuesto en `/api/docs` y JSON en `/api/docs-json`. |
| **Configuración Frontend** | Backend vía `NEXT_PUBLIC_API_URL` (ej. `http://localhost:3001/api/v1`) y plataforma vía `NEXT_PUBLIC_OVENBIRD_URL`. Nunca incluir `OVENBIRD_CLIENT_SECRET` en el frontend. |
| **Ovenbird `allowedOrigins`** | Cada grupo debe registrar en su proyecto de Ovenbird los orígenes de prueba (`http://localhost:3000`, `http://localhost:3001` y URLs desplegadas) para que `@ovenbird/react` funcione en pruebas cruzadas. |

---

## 6. Modelos base unificados 

```typescript
// AuthToken (login / register)
{
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: number; // segundos
  // Opcionales permitidos (frontends ajenos los ignoran): refreshToken?, user?
}

// User
{
  id: string;
  email: string;
  name: string;
  phone?: string | null; // Opcional
}

// Pet
{
  id: string;
  name: string;                     // Obligatorio al crear
  species: "dog" | "cat" | "other"; // Obligatorio al crear (aceptar strings)
  breed?: string | null;            // Opcional
  birthDate?: string | null;        // Opcional (ISO 8601 o YYYY-MM-DD)
  photoUrl?: string | null;         // Opcional
  deviceId: string | null;          // ID de dispositivo en Ovenbird o null
  createdAt: string;                // ISO 8601 UTC
  updatedAt: string;                // ISO 8601 UTC
}

// Device
{
  deviceId: string;
  name: string;
  productId: string;                // "ob.lora.unit"
  online: boolean;
  lastSeenAt: string | null;        // ISO 8601 UTC o null
  petId: string | null;             // null si está libre para vincular
}

// Problem (RFC 9457)
{
  type: string;
  title: string;
  status: number;
  detail: string;
  code: string;                     // UPPER_SNAKE_CASE
  errors?: Array<{ field: string; message: string }>;
}
```

---

## 7. Rutas que TODOS los grupos deben tener exactamente iguales

Estas **14 rutas comunes** son la base obligatoria que cualquier Frontend espera encontrar en cualquier Backend:

| Módulo | Método y ruta exacta | Auth | Request / Query | Response | Errores esperados |
| --- | --- | :---: | --- | --- | --- |
| **Auth** | `POST /api/v1/auth/register` | Pública | `{ email, password (≥8), name, phone? }` | `201 AuthToken` | `400`, `409 EMAIL_ALREADY_EXISTS` / `EMAIL_TAKEN` |
| **Auth** | `POST /api/v1/auth/login` | Pública | `{ email, password }` | `200 AuthToken` | `400`, `401 INVALID_CREDENTIALS` |
| **Auth** | `GET /api/v1/auth/me` | Bearer | — | `200 User` | `401` |
| **Mascotas** | `GET /api/v1/pets` | Bearer | `?page=1&limit=20` | `200 { data: Pet[], meta }` | `401` |
| **Mascotas** | `POST /api/v1/pets` | Bearer | `{ name, species, breed?, birthDate?, photoUrl? }` | `201 Pet` | `400`, `401` |
| **Mascotas** | `GET /api/v1/pets/{petId}` | Bearer | — | `200 Pet` | `401`, `404 PET_NOT_FOUND` |
| **Mascotas** | `PATCH /api/v1/pets/{petId}` | Bearer | Campos parciales de `Pet` | `200 Pet` | `400`, `401`, `404 PET_NOT_FOUND` |
| **Mascotas** | `DELETE /api/v1/pets/{petId}` | Bearer | — | `204 No Content` | `401`, `404 PET_NOT_FOUND` |
| **Dispositivos** | `POST /api/v1/pairing-codes` | Bearer | `{ label? }` | `201 { code, expiresAt }` | `401`, `502`/`503` |
| **Dispositivos** | `GET /api/v1/devices` | Bearer | `?page=1&limit=20` | `200 { data: Device[], meta? }` | `401`, `502`/`503` |
| **Dispositivos** | `PUT /api/v1/pets/{petId}/device` | Bearer | `{ deviceId }` | `200 Pet` | `400`, `401`, `404`, `409` |
| **Dispositivos** | `DELETE /api/v1/pets/{petId}/device` | Bearer | — | `204 No Content` | `401`, `404` |
| **Mapa** | `POST /api/v1/embed-token` | Bearer | `{ deviceIds?: string[], petId?, ttlS? }` | `200 { token, expiresAt }` | `401`, `403`, `409 NO_LINKED_DEVICES` |
| **Variantes** | `GET /api/v1/capabilities` | Pública | — | `200 { apiVersion: "1", variants: string[] }` | — |

### Reglas de comportamiento obligatorias en las 14 rutas comunes
1. **Aislamiento estricto por usuario:** cualquier `petId` ajeno responde `404 PET_NOT_FOUND` (nunca `403` que revele existencia).
2. **`DELETE /api/v1/pets/{petId}`:** si tenía collar vinculado, lo desvincula (`petId = null`) antes de borrar la mascota.
3. **`GET /api/v1/devices`:** filtra `ob.devices.list()` para devolver únicamente collares ya vinculados al usuario + collares sin vincular aparecidos dentro de la vigencia de 10 minutos de un código de emparejamiento generado por ese usuario.
4. **`PUT /api/v1/pets/{petId}/device`:**
   - Si `deviceId` está vinculado a otra mascota → `409 DEVICE_ALREADY_LINKED`.
   - Si la mascota ya tiene otro `deviceId` distinto → `409 PET_ALREADY_HAS_DEVICE`. Si es el mismo `deviceId` → `200 Pet` (idempotente).
5. **`POST /api/v1/embed-token`:** si no se pasa `deviceIds`, toma todos los `deviceId` vinculados del usuario (`1..50`); si no tiene ninguno, devuelve `409 NO_LINKED_DEVICES`. Si se pasan `deviceIds` o `petId`, verifica pertenencia al usuario.
6. **Traducción de `@ovenbird/node`:** `OvenbirdNotFoundError` → `404`, `OvenbirdValidationError` → `422`, `OvenbirdRateLimitError` → `429`, `OvenbirdAuthError` / red / `5xx` → `502`/`503` sin filtrar secretos.

---

# PARTE III — Qué debe hacer cada Grupo (Responsabilidades y Variantes)

## Regla de aislamiento de variantes (`GET /api/v1/capabilities`)

1. **Todo Backend** implementa obligatoriamente:
   - La **Interfaz 1 completa** (en su Collar y Unidad) + **las 14 rutas comunes** de la Interfaz 2.
   - `GET /api/v1/capabilities` anunciando únicamente el identificador oficial de **su** variante.
   - Sus endpoints propios de variante (prefijo `/api/v1/...`, marcados con `x-variant` en Swagger).
2. **Todo Frontend** implementa obligatoriamente:
   - Todas las pantallas base (Login/Registro, Mis Mascotas, Emparejar y Vincular Collar, Mapa en vivo con `@ovenbird/react`).
   - Lectura de `GET /api/v1/capabilities` al iniciar sesión: **muestra los botones/pantallas de una variante solo si su identificador está en `variants`** (si `/capabilities` da `404`, asume `variants = []` y opera en modo base limpio).
   - **Si alguien llama por error a una ruta de variante no implementada**, el Backend simplemente responde `404 Not Found` (RFC 9457).

## Qué le toca implementar explícitamente a cada uno de los 8 grupos

| Grupo | Variante asignada | ID en `variants` | Qué debe hacer en Firmware (Collar/Unidad) | Qué debe hacer en Backend/Frontend (además de la base común) |
| :---: | --- | --- | --- | --- |
| **Grupo 1** | **Ahorro de energía y seguimiento básico** | `power-saving` | Collar con `MODO_AHORRO=1` y `ESCUCHA_CONTINUA=0` cuando `SET_INTERVAL ≥ 100 s` (ej. `150 s`), ventana RX de `500 ms` post-TX. Unidad encola comandos hasta la próxima TX. | Botón/selector de modo ahorro vs normal enviando `report_interval_s` (`150` vs `15`) vía `ob.commands.send`. |
| **Grupo 2** | **Calidad de señal y GPS** | `gps-quality` | Collar agrega TLV `0x20 GPS_QUALITY` (`sats`, `hdop_x100`). Unidad lee además `RSSI`/`SNR` LoRa y publica métricas de enlace. | Panel/endpoints de calidad GPS y enlace LoRa (`RSSI`, `SNR`, `hdop`, `fix`). |
| **Grupo 3** | **Alerta de pérdida de enlace y zonas** | `link-loss-zones` | Usa telemetría común + criterio `collar_online` (§4.5). Sin comandos LoRa extra obligatorios. | CRUD de zonas seguras / geocercas en backend, evaluación contra `location` de Ovenbird y alertas de pérdida de enlace o salida de zona. |
| **Grupo 4** | **Buscar y guiar (buzzer / LED)** | `find-and-guide` | Collar con `ESCUCHA_CONTINUA=1` y feedback sonoro/luminoso en `FIND_ME`. Unidad muestra en OLED/LEDs frescura de posición, señal y estado `Enviado → Confirmado`. | Endpoints `POST /pets/{petId}/find-me` (`202 Accepted`) y `GET /pets/{petId}/commands/{commandId}` + UI de progreso en tiempo real. |
| **Grupo 5** | **Historial de recorridos** | `history-routes` | Sin cambios en LoRa (usa telemetría común). | Endpoints de consulta/estadísticas sobre `ob.devices.history` (distancia, velocidad, tiempo en movimiento) + visualización de ruta histórica en mapa. |
| **Grupo 6** | **Compartir acceso y roles** | `sharing-roles` | Sin cambios en LoRa (usa telemetría común). | Gestión de invitaciones y roles (`owner` / `caregiver` / `viewer`) en backend verificando permisos por mascota antes de emitir `embed-token` o enviar comandos. |
| **Grupo 7** *(Nosotros)* | **Mascota perdida** | `lost-pet` | Sin cambios obligatorios en LoRa (usa `SET_INTERVAL` y `FIND_ME` comunes). | `POST /pets/{petId}/lost` (marca perdida, envía `report_interval_s: 5` y `find_me: 5`, genera `publicToken`), `DELETE /pets/{petId}/lost` (revoca link y vuelve a `60 s`) y `@Public() GET /public/lost-pet/{token}` (vista pública sin cuenta). |
| **Grupo 8** | **Notificaciones** | `notifications` | Sin cambios en LoRa (usa telemetría común + `BAT` + `collar_online`). | Suscripción a `ob.events.subscribe` (SSE), reglas configurables (batería baja, offline, regreso) y feed/endpoints de notificaciones para el frontend. |

---

## Checklist rápida para pruebas cruzadas en clase

1. **Collar Grupo A ↔ Unidad Grupo B:** configurar el mismo `DEV_ID` en ambos, verificar `RadioSim` (`115200 8N1`) o LoRa (`433.175 MHz`, `SF7`, `BW 125 kHz`, `CR 4/5`, `0x12`), probar telemetría `0x01`, `SET_INTERVAL 0x01`, `FIND_ME 0x02` y `REQUEST_TELEMETRY 0x03`.
2. **Frontend Grupo A ↔ Backend Grupo B:** cambiar únicamente `NEXT_PUBLIC_API_URL` en `.env.local`, verificar que el login, listado de mascotas, emparejamiento, mapa (`embed-token`) funcionan y que los botones de variantes no anunciadas en `GET /api/v1/capabilities` se ocultan limpiamente.
3. **Ovenbird `allowedOrigins`:** asegurarse de que el proyecto en Ovenbird del dueño del Backend tenga cargado el origen (`http://localhost:3000`, etc.) donde corre el Frontend del otro grupo.
