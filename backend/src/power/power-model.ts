/**
 * Modelo de consumo del collar (Arduino Nano + SX1278 + NEO-6M) — función pura.
 *
 * Corriente media = carga consumida en un ciclo de reporte / duración del ciclo.
 * Autonomía = capacidad de la batería / corriente media.
 * Fuentes y supuestos de cada número: docs/03-variante-ahorro-energia.md §"Modelo de consumo".
 */

/** Desde este intervalo el firmware entra en modo ahorro (docs/03). */
export const SAVING_THRESHOLD_S = 100;

/** Corrientes en mA y tiempos en s (datasheets; ver docs/03). */
export const DEFAULT_PARAMS = {
  /** ATmega328P a 16 MHz / 5 V, activo (datasheet Atmel, fig. 29-332 aprox.). */
  mcuActiveMa: 9.0,
  /** ATmega328P en SLEEP_MODE_IDLE a 16 MHz / 5 V. */
  mcuIdleMa: 3.0,
  /** SX1278 transmitiendo a +14 dBm por PA_BOOST (entre 29 mA @+13 dBm y 87 mA @+17 dBm). */
  radioTxMa: 44.0,
  /** SX1278 en RX, LnaBoost activado, banda baja (IDDR_L ≈ 10.8 mA). */
  radioRxMa: 10.8,
  /** SX1278 en sleep (IDDSL ≈ 0.2 µA). */
  radioSleepMa: 0.0002,
  /** NEO-6M adquiriendo (calentamiento antes de cada TX en ahorro). */
  gpsAcquisitionMa: 47.0,
  /** NEO-6M siguiendo satélites (modo continuo). */
  gpsTrackingMa: 37.0,
  /** GPS_EN apagado: el módulo queda sin alimentación. */
  gpsOffMa: 0,
  /** Ventana de recepción después de cada TX en ahorro (firmware: 500 ms). */
  rxWindowS: 0.5,
  /** Precalentamiento del GPS antes de cada TX en ahorro (firmware: GPS_WARMUP_MS = 8 s). */
  gpsWarmupS: 8,
  /** Telemetría: 23 bytes base + TLV 0x10 G1_POWER_PROFILE (5 bytes). */
  telemetryBytes: 28,
};

export type PowerModelParams = typeof DEFAULT_PARAMS;

/**
 * Tiempo en el aire de una trama LoRa (fórmula de la nota AN1200.13 de Semtech).
 * Por defecto los parámetros del acuerdo: SF7, BW 125 kHz, CR 4/5, preámbulo 8, header
 * explícito, CRC activado, sin low data rate optimize.
 */
export function loraTimeOnAirMs(
  payloadBytes: number,
  sf = 7,
  bwHz = 125_000,
  codingRate = 1, // 1 = 4/5
  preambleSymbols = 8,
): number {
  const tSym = (2 ** sf / bwHz) * 1000;
  const lowDataRate = tSym > 16 ? 1 : 0;
  const tPreamble = (preambleSymbols + 4.25) * tSym;
  const header = 0; // 0 = header explícito
  const crc = 1;
  const num = 8 * payloadBytes - 4 * sf + 28 + 16 * crc - 20 * header;
  const den = 4 * (sf - 2 * lowDataRate);
  const payloadSymbols =
    8 + Math.max(Math.ceil(num / den) * (codingRate + 4), 0);
  return tPreamble + payloadSymbols * tSym;
}

/** Corriente media (mA) del collar para un intervalo de reporte dado. */
export function avgCurrentMa(
  intervalS: number,
  p: PowerModelParams = DEFAULT_PARAMS,
): number {
  const toa = loraTimeOnAirMs(p.telemetryBytes) / 1000;

  if (intervalS < SAVING_THRESHOLD_S) {
    // Normal: MCU activo, GPS siempre encendido, radio en RX continua salvo al transmitir.
    const radio =
      (p.radioTxMa * toa + p.radioRxMa * (intervalS - toa)) / intervalS;
    return p.mcuActiveMa + p.gpsTrackingMa + radio;
  }

  // Ahorro: por ciclo se despierta para calentar el GPS, transmitir y escuchar 500 ms.
  const awake = p.gpsWarmupS + toa + p.rxWindowS;
  const mcu = p.mcuActiveMa * awake + p.mcuIdleMa * (intervalS - awake);
  const gps =
    p.gpsAcquisitionMa * p.gpsWarmupS + p.gpsOffMa * (intervalS - p.gpsWarmupS);
  const radio =
    p.radioTxMa * toa +
    p.radioRxMa * p.rxWindowS +
    p.radioSleepMa * (intervalS - toa - p.rxWindowS);
  return (mcu + gps + radio) / intervalS;
}

export type ModeEstimate = {
  avgCurrentMa: number;
  hoursFull: number;
  hoursRemaining: number | null;
};

export type PowerEstimates = { normal: ModeEstimate; saving: ModeEstimate };

const round = (n: number, decimals: number) => {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
};

/** Autonomía de cada modo con carga completa y con la carga actual (si se conoce). */
export function estimatePower(input: {
  capacityMah: number;
  batteryPct: number | null;
  normalIntervalS: number;
  savingIntervalS: number;
  params?: PowerModelParams;
}): PowerEstimates {
  const pct =
    input.batteryPct === null
      ? null
      : Math.min(100, Math.max(0, input.batteryPct));
  const mode = (intervalS: number): ModeEstimate => {
    const current = avgCurrentMa(intervalS, input.params);
    const hoursFull = input.capacityMah / current;
    return {
      avgCurrentMa: round(current, 2),
      hoursFull: round(hoursFull, 1),
      hoursRemaining: pct === null ? null : round((hoursFull * pct) / 100, 1),
    };
  };
  return {
    normal: mode(input.normalIntervalS),
    saving: mode(input.savingIntervalS),
  };
}
