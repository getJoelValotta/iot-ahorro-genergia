# Decisiones de arquitectura (acordadas el 2026-11-23)

Resultado de la sesión de definición previa a codear backend, frontend y la prueba E2E con Wokwi.
El paso a paso de implementación está en [PLAN.md](PLAN.md); lo que tiene que hacer el equipo a
mano, en [avances.md](avances.md).

## 1. Flujo completo

**Entrega (hardware real):**
```
Collar (Nano) --LoRa--> Unidad (ESP32) --BLE--> celular con Ovenbird Smart --HTTPS--> Ovenbird Cloud
                                                                                         │ @ovenbird/node
                                       Frontend Next.js <-- cookie --> (servidor Next) --> Backend NestJS --> Supabase
                                       (mapa con @ovenbird/react directo contra Ovenbird)
```

**Prueba con Wokwi (sin hardware):** mismo firmware compilado con `*_sim`. Wokwi no simula LoRa
ni BLE, así que un script Python reemplaza esas dos piezas:

```
[Wokwi: collar] <-- "aire LoRa" --> [Wokwi: unidad] <-- "BLE" (consola) --> [celular falso] --> Ovenbird --> back --> front
                \__________________ firmware/tools/radiosim_bridge.py __________________/
```

El "celular falso" usa los mismos endpoints públicos que usa la app (relevados de `openapi.json`):

| Paso | Endpoint | Auth |
|---|---|---|
| Emparejar con el código que muestra el front | `POST /v1/app/pair { code, productId: "ob.lora.unit", uid, name }` → `bridgeToken` | ninguna |
| Subir lo que la unidad publica por BLE (`# BLE LOCATION/STATUS`) | `POST /v1/ingest { reports: [{ seq, ts, dps }] }` | Bearer `bridgeToken` |
| Recibir comandos (ej. activar ahorro) | `GET /v1/bridge/commands?wait=...` (long-poll) → `>ble <hex>` a la unidad | Bearer |
| Confirmar comando con el `COMMAND_ACK` de la unidad | `POST /v1/bridge/commands/{id}/ack { result: "ok"|"error" }` | Bearer |

Formatos reales (relevados contra la plataforma): `ts` en **segundos** Unix; los comandos llegan como
`{ items: [{ commandId, deviceId, dps, status }] }`. Re-emparejar el mismo `uid` con un código nuevo
conserva el mismo `deviceId`.

El jueves se reemplaza el script por el celular y `*_sim` por `*_lora`; lo único que no se prueba
en simulación es la capa física de radio y BLE.

## 2. Decisiones

| Tema | Decisión | Por qué |
|---|---|---|
| Backend | NestJS 11 + Jest, desplegado en **Vercel** (función serverless) | La consigna pide Nest y Jest; Vercel junto al front es lo más simple. |
| Consecuencia serverless | Sin procesos de fondo ni SSE persistente. El estado del comando de ahorro se actualiza **a demanda** (al consultar, con `ob.commands.get`). | Ni la base ni la variante necesitan tareas de fondo. |
| Base de datos | **Supabase** (Postgres). Local: `supabase start` (Docker, cada uno la suya). Producción: proyecto en la nube. Tablas con migraciones SQL en `supabase/migrations/`. | El equipo ya usa Supabase CLI; cero administración. |
| Acceso a la base | `@supabase/supabase-js` con la clave de servicio (solo en el back), detrás de un **repositorio por módulo**. En Jest se usa un repositorio falso. | Simple, funciona en serverless y deja los tests aislados. Sin Prisma. |
| Autenticación | **Propia**: contraseña con bcrypt + JWT `Bearer` emitido por el back (1 h). Sin Supabase Auth. | Es lo documentado en el contrato (`AuthToken`). |
| Token en el front | **Nunca en `localStorage`.** El servidor de Next hace de intermediario (BFF): guarda el token en una cookie `httpOnly` de su dominio y reenvía cada llamada al back con `Authorization: Bearer`. | Evita robo del token por XSS y sigue cumpliendo el contrato (ver §3). |
| Frontend | Next.js (app router) + Tailwind + shadcn/ui; mapa/estado con `@ovenbird/react`. En Vercel. | Lo pide la consigna; rápido para lograr algo responsive. |
| SDK de Ovenbird | Los `.tgz` se **commitean** en `vendor/` y se instalan como `file:../vendor/...`. | Vercel construye desde git: sin el archivo, el build falla. |
| Variante | El modo pedido (normal/ahorro) se guarda en nuestra base; Ovenbird no reporta `report_interval_s` y el flag `MODO_AHORRO` no viaja por BLE. | La base es la fuente de verdad del modo deseado; el estado del comando dice si el collar lo aplicó. |
| Batería | Capacidad **de ejemplo: 1000 mAh** (`BATTERY_CAPACITY_MAH`), documentada como supuesto. | No sabemos qué batería va a tener el collar; es un dato del hardware, no del usuario. |
| Prueba E2E Wokwi | `radiosim_bridge.py` suma el modo "celular" (módulo aparte `ble_cloud.py` con pytest). | Un puerto serie de Wokwi se abre una sola vez; un solo proceso maneja todo. |
| Verificación | (a) Jest + supertest sobre el back con el SDK simulado, más `pio test -e native` y pytest, en GitHub Actions. (b) Guion manual de la demo con Wokwi en `docs/07-demo.md`. | La consigna pide pruebas de funciones críticas y un modo de verificar de punta a punta. |
| Git | Todo directo a `main`, un commit por parte terminada. | Decisión del equipo (plazo corto). |
| Puertos locales | Back `3001`, front `3000`, Supabase local `54331` (API) / `54332` (Postgres). | Back y front coinciden con `docs/01`. Supabase se corrió 10 puertos para convivir con otros proyectos de Supabase en la misma PC (`supabase/config.toml`). |

## 3. Compatibilidad con otros grupos

### 3.1 Versión tolerante entre `docs/01` (oficial) y `docs/05` (referencia)

| Punto | `docs/01` | `docs/05` | Qué hacemos |
|---|---|---|---|
| `Device.lastSeenAt` | `string \| null` | siempre `string` | `null` solo si nunca se vio. El front acepta ambos. |
| `GET /devices` | `{ data, meta? }` | `{ data }` | Devolvemos `{ data, meta }`. El front no exige `meta`. |
| `POST /pairing-codes` | `{ label? }` | sin body | Body opcional; si falta, label por defecto. |
| Ruta de variante no soportada | `404` | `501` opcional | Devolvemos `404` (problem+json). El front trata `404` y `501` igual. |
| `POST /embed-token` | `{ deviceIds?, petId?, ttlS? }` | `{ deviceIds? }` | Aceptamos todo; `ttlS` por defecto 900 y se **ajusta** a 60..3600 (no da 400). |
| `409` de email | `EMAIL_ALREADY_EXISTS` / `EMAIL_TAKEN` | `EMAIL_TAKEN` | Devolvemos `code: "EMAIL_TAKEN"`. |
| Puerto del back | `3001` | `3000` | `3001` (el `3000` es de Next). |
| "Aparecidos en la ventana" de `GET /devices` | regla 3 | — | Un collar libre se ve si se **creó o reportó** (`createdAt` o `lastSeenAt`) durante un código del usuario: Ovenbird conserva `deviceId` y `createdAt` al re-emparejar el mismo `uid`. |
| Campos opcionales de `Pet`/`User` | `?: string \| null` | `?: string` | Devolvemos `null` cuando falta; el front acepta `null` o ausente. |

### 3.2 Intermediario con cookie (BFF): riesgos y mitigaciones

El contrato define **cómo se comporta el back** (recibe `Bearer`, CORS abierto), no dónde guarda el
token cada front. El ejemplo de `docs/05` §6.3 (el navegador llama directo al back) es un ejemplo,
no una regla.

| Escenario / riesgo | Qué pasa | Mitigación |
|---|---|---|
| Front de otro grupo → **nuestro back** | Funciona igual: aceptamos `Bearer` y `enableCors()`. | Nada que hacer. |
| **Nuestro front** → back de otro grupo | El servidor Next llama al back ajeno con `Bearer`. CORS no interviene (es servidor a servidor). | Cambiar `NEXT_PUBLIC_API_URL` y reiniciar, como pide el acuerdo. |
| `NEXT_PUBLIC_*` se fija al compilar | En el servidor se lee en tiempo de ejecución: `API_URL ?? NEXT_PUBLIC_API_URL`. | Documentado en `frontend/.env.example`. |
| El back ajeno no manda `expiresIn` | La cookie quedaría sin vencimiento claro. | Si falta, usamos 3600 s. |
| `401` del back (token vencido o inválido) | — | El Next borra la cookie y redirige a `/login`. |
| Errores sin `problem+json` | — | Mensaje: `detail ?? title ?? "Error inesperado"`; nunca se muestran detalles internos. |
| `GET /capabilities` da `404` o falla | — | `variants = []`: modo base, se oculta la UI de ahorro. |
| Mapa con back ajeno | El `embed-token` sale del tenant de Ovenbird **del otro grupo**. | Ellos deben cargar nuestro origen (`http://localhost:3000` y la URL de Vercel) en su proyecto. |
| CSRF (la cookie viaja sola) | — | Cookie `httpOnly`, `SameSite=Lax`, `Secure` en producción. Las rutas que modifican datos son POST/PUT/PATCH/DELETE con JSON, y el Next verifica el header `Origin`. |
| Demo cruzada en el aula por IP (`http://192.168...`) | `Secure` impide la cookie en HTTP. | `Secure` solo con `NODE_ENV=production`; en local, HTTP funciona. |

## 4. Variante `power-saving` (back + front)

Pantalla: en la ficha de cada mascota con collar aparece la tarjeta **"Batería y ahorro"**, con la
batería actual, el interruptor Normal/Ahorro, el estado del cambio ("Enviando…" / "Aplicado en el
collar" / "El collar no respondió") y la duración estimada de cada modo.

Rutas (marcadas `x-variant: power-saving` en Swagger; `power-saving` en `/capabilities`):

```ts
// GET /api/v1/pets/{petId}/power  → 200
// PUT /api/v1/pets/{petId}/power  { mode: "normal" | "saving" } → 202 (mismo cuerpo)
{
  mode: "normal" | "saving";            // modo pedido (guardado en la base)
  reportIntervalS: number;              // 15 (normal) | 150 (ahorro), configurables
  command: {
    status: "none" | "pending" | "confirmed" | "failed";
    commandId: string | null;
    requestedAt: string | null;          // ISO 8601 UTC
  };
  batteryPct: number | null;             // de ob.devices.status (null si no hay dato)
  batteryCapacityMah: number;            // 1000 (supuesto, BATTERY_CAPACITY_MAH)
  estimates: {
    normal: { avgCurrentMa: number; hoursFull: number; hoursRemaining: number | null };
    saving: { avgCurrentMa: number; hoursFull: number; hoursRemaining: number | null };
  };
}
// Errores: 404 PET_NOT_FOUND · 409 PET_HAS_NO_DEVICE · 502/503 (Ovenbird)
```

El modelo de consumo es una **función pura** en el back (`power-model.ts`, con test). Usa las
corrientes de datasheet de ATmega328P, SX1278 y NEO-6M, el tiempo en el aire de la trama
(SF7/BW125) y la ventana RX, según [03-variante-ahorro-energia.md](03-variante-ahorro-energia.md).
Resultado del modelo con 1000 mAh: **≈ 57 mA → ≈ 18 h** en normal y **≈ 5,9 mA → ≈ 7 días** en
ahorro (la primera estimación a mano era ~13 h y ~2–3 días).

## 5. Base de datos (primera migración)

| Tabla | Columnas |
|---|---|
| `users` | `id uuid pk`, `email text unique` (en minúsculas), `name`, `phone null`, `password_hash`, `created_at`, `updated_at` |
| `pets` | `id uuid pk`, `owner_id → users`, `name`, `species`, `breed null`, `birth_date null`, `photo_url null`, `device_id text unique null`, `power_mode` (`normal`/`saving`), `power_command_id null`, `power_command_status`, `power_requested_at null`, `created_at`, `updated_at` |
| `pairing_sessions` | `id uuid pk`, `user_id → users`, `code`, `expires_at`, `created_at` (para filtrar `GET /devices` por la ventana de 10 min) |

`device_id unique` garantiza a nivel de base el `409 DEVICE_ALREADY_LINKED`. Row Level Security
queda activado sin políticas: solo entra la clave de servicio del back.

## 6. Variables de entorno (sin valores; los valores reales nunca van al repo ni al chat)

**`backend/.env`**: `PORT=3001`, `JWT_SECRET`, `JWT_EXPIRES_IN_S=3600`, `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, `OVENBIRD_URL`, `OVENBIRD_CLIENT_ID`, `OVENBIRD_CLIENT_SECRET`,
`EMBED_TOKEN_TTL_S=900`, `BATTERY_CAPACITY_MAH=1000`, `POWER_NORMAL_INTERVAL_S=15`,
`POWER_SAVING_INTERVAL_S=150`.

**`frontend/.env.local`**: `NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1`,
`NEXT_PUBLIC_OVENBIRD_URL=https://iotplatform.ovenbirdconsulting.com.ar`, `API_URL` (opcional,
pisa a la anterior en el servidor), `COOKIE_SECURE` (opcional, fuerza `Secure` en la cookie).

**Script Wokwi** (`firmware/tools`): `OVENBIRD_URL`; el código de emparejamiento y el UID de
prueba van por parámetro (`--pair-code`, `--uid`).
