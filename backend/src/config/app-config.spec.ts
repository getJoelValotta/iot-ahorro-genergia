import { TEST_ENV } from '../testing/test-app';
import { ConfigError, loadConfig } from './app-config';

describe('loadConfig', () => {
  it('aplica los valores por defecto de docs/06', () => {
    expect(loadConfig(TEST_ENV)).toMatchObject({
      port: 3001,
      jwtExpiresInS: 3600,
      embedTokenTtlS: 900,
      batteryCapacityMah: 1000,
      powerNormalIntervalS: 15,
      powerSavingIntervalS: 150,
    });
  });

  it('falla con un mensaje que nombra la variable faltante, sin mostrar valores', () => {
    const env = {
      ...TEST_ENV,
      OVENBIRD_CLIENT_SECRET: '',
      JWT_SECRET: 'corto',
    };
    expect(() => loadConfig(env)).toThrow(ConfigError);
    try {
      loadConfig(env);
    } catch (err) {
      const msg = (err as Error).message;
      expect(msg).toContain('OVENBIRD_CLIENT_SECRET');
      expect(msg).toContain('JWT_SECRET');
      expect(msg).not.toContain('corto');
    }
  });

  it('rechaza números inválidos e intervalos que no respetan el umbral de ahorro', () => {
    expect(() => loadConfig({ ...TEST_ENV, PORT: 'abc' })).toThrow(/PORT/);
    expect(() =>
      loadConfig({ ...TEST_ENV, POWER_SAVING_INTERVAL_S: '60' }),
    ).toThrow(/POWER_SAVING_INTERVAL_S/);
  });
});
