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

## Backend y frontend (decidido el 2026-11-23)

Rutas, pantalla, modelo de datos y capacidad de batería de ejemplo (**1000 mAh**, supuesto
documentado porque no sabemos qué batería va a tener el collar): ver
[06-decisiones-arquitectura.md §4](06-decisiones-arquitectura.md#4-variante-power-saving-back--front).
El modo pedido se guarda en nuestra base (Ovenbird no reporta `report_interval_s`).

## Modelo de consumo

Implementado como función pura en `backend/src/power/power-model.ts` (con test). Ese archivo
remite a esta sección. **Corriente media** = carga gastada en un ciclo de reporte ÷ duración del
ciclo. **Autonomía** = capacidad de la batería ÷ corriente media; con la carga actual, se multiplica
por el `battery_pct` que reporta Ovenbird.

### Valores usados (datasheets, a 5 V)

| Componente | Estado | Corriente | Fuente / supuesto |
|---|---|---|---|
| ATmega328P (16 MHz) | activo | 9 mA | Datasheet Atmel, curvas de consumo activo. |
| ATmega328P | `SLEEP_MODE_IDLE` | 3 mA | Ídem, modo idle (el firmware usa idle para no perder `millis()` ni la UART). |
| SX1278 | TX +14 dBm (PA_BOOST) | 44 mA | Interpolado entre 29 mA @ +13 dBm y 87 mA @ +17 dBm (datasheet Semtech). |
| SX1278 | RX (LNA boost, banda baja) | 10,8 mA | Datasheet Semtech, `IDDR_L`. |
| SX1278 | sleep | 0,2 µA | Datasheet Semtech, `IDDSL`. |
| NEO-6M | adquisición | 47 mA | Datasheet u-blox NEO-6. |
| NEO-6M | seguimiento | 37 mA | Ídem. |
| NEO-6M | apagado (`GPS_EN`) | 0 mA | Se le corta la alimentación. |

Tiempos:
- Trama de telemetría de 28 bytes (23 de base + TLV `0x10` de 5). Con los parámetros del acuerdo
  (SF7, BW 125 kHz, CR 4/5, preámbulo 8, CRC), su **tiempo en el aire es ≈ 66,8 ms** (fórmula de
  la nota AN1200.13 de Semtech).
- Ventana de escucha después de cada TX: 500 ms.
- Precalentamiento del GPS antes de cada TX: 8 s (`GPS_WARMUP_MS`).

### Cuentas (intervalos 15 s y 150 s)

- **Normal**: MCU activo + GPS siguiendo + radio en RX continua salvo al transmitir.
  9 + 37 + (44 × 0,067 + 10,8 × 14,93) / 15 ≈ **57 mA**.
- **Ahorro**: por ciclo, el MCU y el GPS están despiertos 8,57 s (precalentamiento + TX +
  ventana) y el resto el MCU queda en idle con GPS y radio apagados.
  (501 mAs MCU + 376 mAs GPS + 8 mAs radio) / 150 s ≈ **5,9 mA**.

| | Corriente media | Autonomía con 1000 mAh |
|---|---|---|
| Normal (15 s) | ≈ 57 mA | ≈ 18 h |
| Ahorro (150 s) | ≈ 5,9 mA | ≈ 7 días |

### Supuestos y límites
- **Capacidad de 1000 mAh**: es un ejemplo, porque no sabemos qué batería va a tener el collar.
  Se configura con `BATTERY_CAPACITY_MAH`.
- No se cuentan las pérdidas del regulador ni el LED de encendido de la placa Nano, que en una
  placa comercial pueden sumar varios mA. El número sirve para **comparar los modos**, no como
  promesa exacta.
- La ventana de 3 s de la simulación (`collar_sim`) no entra en el modelo: es solo para Wokwi.
- En ahorro, el ~57 % del consumo es el MCU en idle. Si hiciera falta más autonomía, el siguiente
  paso sería `SLEEP_MODE_PWR_DOWN` despertando por watchdog (pierde `millis()` y la UART, por eso
  no se hizo).
- **Validación opcional**: medir con un multímetro en serie en la placa real.
