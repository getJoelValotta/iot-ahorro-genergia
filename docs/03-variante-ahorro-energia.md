# Variante Grupo 1 — Ahorro de energía (`power-saving`)

Consigna: modo de bajo consumo **configurable por el usuario**, que prolongue la batería **sin
dejar de atender órdenes**; cada grupo decide qué reduce; **estimar consumo en modo normal y en
ahorro y mostrar al usuario la autonomía esperada en cada uno**.

## Decisiones ya tomadas (implementadas en firmware)

| | Normal | Ahorro |
| --- | --- | --- |
| Disparador | `report_interval_s < 100` (default 15 s) | `report_interval_s ≥ 100` (UI usa 150 s) |
| FLAGS | `ESCUCHA_CONTINUA=1`, `MODO_AHORRO=0` | `ESCUCHA_CONTINUA=0`, `MODO_AHORRO=1` |
| Radio | RX continua | dormida; RX solo 500 ms post-TX (+500 ms por comando) |
| GPS | siempre encendido | apagado; se enciende `GPS_WARMUP_MS` (8 s) antes de cada TX |
| MCU | activo | `SLEEP_MODE_IDLE` entre eventos |
| Unidad | envía comandos al instante, 3 reintentos c/1 s | encola (4) y envía ≤100 ms tras cada telemetría; 3 ventanas sin ACK ⇒ BLE result 3 |

Extensión propia (ignorable por otros grupos): TLV `0x10` `G1_POWER_PROFILE` (L=3: `modo u8`,
`interval_s u16`) en cada telemetría, para que nuestra unidad conozca `I` y calcule `T_offline`.

## Pendiente (próxima sesión)

1. **Modelo de consumo** (backend, función pura + test): corriente media por modo a partir de
   corrientes de datasheet (ATmega328P activo/idle, SX1278 TX@14 dBm / RX / sleep, NEO-6M
   adquisición/tracking/off), time-on-air LoRa SF7/BW125 de la trama (≈ 23–38 B), duración de
   la ventana RX e intervalo `I`. Autonomía = capacidad batería (configurable, p. ej. 1000 mAh) /
   corriente media. Documentar fuentes de cada valor y supuestos.
2. **Endpoints de variante** (anunciar `power-saving` en `GET /api/v1/capabilities`), p. ej.
   `GET /api/v1/pets/{petId}/power` (modo actual + estimación de ambos modos) y
   `PUT /api/v1/pets/{petId}/power { mode: "normal" | "saving" }` → `ob.commands.send` con
   `report_interval_s` 15 / 150. Marcar con `x-variant` en Swagger.
3. **Frontend**: selector normal/ahorro + tarjeta de autonomía estimada para cada modo
   (solo visible si `variants` incluye `power-saving`).
4. Medir en placa real (opcional) para validar el modelo.
