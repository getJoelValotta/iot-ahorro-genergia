import {
  avgCurrentMa,
  estimatePower,
  loraTimeOnAirMs,
  SAVING_THRESHOLD_S,
} from './power-model';

const base = {
  capacityMah: 1000,
  batteryPct: null as number | null,
  normalIntervalS: 15,
  savingIntervalS: 150,
};

describe('loraTimeOnAirMs (SF7 / BW125 / CR4/5)', () => {
  it('da el valor de la calculadora de Semtech para 28 bytes (~66.8 ms)', () => {
    expect(loraTimeOnAirMs(28)).toBeCloseTo(66.82, 1);
  });

  it('crece con el largo de la trama', () => {
    expect(loraTimeOnAirMs(38)).toBeGreaterThan(loraTimeOnAirMs(23));
  });
});

describe('avgCurrentMa', () => {
  it('el modo ahorro consume mucho menos que el normal', () => {
    expect(avgCurrentMa(150)).toBeLessThan(avgCurrentMa(15) / 3);
  });

  it('usa el comportamiento de ahorro desde el umbral del firmware (100 s)', () => {
    expect(SAVING_THRESHOLD_S).toBe(100);
    expect(avgCurrentMa(99)).toBeGreaterThan(avgCurrentMa(100) * 3);
  });

  it('en ahorro, intervalos más largos consumen menos', () => {
    expect(avgCurrentMa(600)).toBeLessThan(avgCurrentMa(150));
  });

  it('da valores en un rango razonable para un collar con GPS', () => {
    const normal = avgCurrentMa(15);
    const saving = avgCurrentMa(150);
    expect(normal).toBeGreaterThan(30);
    expect(normal).toBeLessThan(120);
    expect(saving).toBeGreaterThan(1);
    expect(saving).toBeLessThan(20);
  });
});

describe('estimatePower', () => {
  it('el modo ahorro dura más que el normal', () => {
    const e = estimatePower(base);
    expect(e.saving.hoursFull).toBeGreaterThan(e.normal.hoursFull);
  });

  it('la autonomía escala con la capacidad de la batería', () => {
    const a = estimatePower(base);
    const b = estimatePower({ ...base, capacityMah: 2000 });
    expect(b.normal.hoursFull).toBeCloseTo(a.normal.hoursFull * 2, 0);
    expect(b.saving.hoursFull).toBeCloseTo(a.saving.hoursFull * 2, 0);
  });

  it('las horas restantes escalan con el porcentaje de batería', () => {
    const e = estimatePower({ ...base, batteryPct: 50 });
    expect(e.normal.hoursRemaining).toBeCloseTo(e.normal.hoursFull / 2, 0);
    expect(e.saving.hoursRemaining).toBeCloseTo(e.saving.hoursFull / 2, 0);
  });

  it('sin dato de batería las horas restantes son null', () => {
    const e = estimatePower(base);
    expect(e.normal.hoursRemaining).toBeNull();
    expect(e.saving.hoursRemaining).toBeNull();
  });

  it('acota porcentajes fuera de rango', () => {
    expect(
      estimatePower({ ...base, batteryPct: 150 }).normal.hoursRemaining,
    ).toBe(estimatePower(base).normal.hoursFull);
    expect(
      estimatePower({ ...base, batteryPct: -5 }).normal.hoursRemaining,
    ).toBe(0);
  });

  it('con 1000 mAh: normal dura menos de un día y ahorro varios días', () => {
    const e = estimatePower(base);
    expect(e.normal.hoursFull).toBeGreaterThan(8);
    expect(e.normal.hoursFull).toBeLessThan(24);
    expect(e.saving.hoursFull).toBeGreaterThan(48);
  });
});
