/**
 * Configuración del backend, validada al arrancar (docs/06 §6). Si falta una variable obligatoria
 * o un número es inválido, el proceso no arranca y el mensaje dice cuál (nunca su valor).
 */
export type AppConfig = {
  port: number;
  jwtSecret: string;
  jwtExpiresInS: number;
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  ovenbirdUrl: string;
  ovenbirdClientId: string;
  ovenbirdClientSecret: string;
  embedTokenTtlS: number;
  batteryCapacityMah: number;
  powerNormalIntervalS: number;
  powerSavingIntervalS: number;
};

export const APP_CONFIG = Symbol('APP_CONFIG');

type Env = Record<string, string | undefined>;

const REQUIRED = [
  'JWT_SECRET',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'OVENBIRD_URL',
  'OVENBIRD_CLIENT_ID',
  'OVENBIRD_CLIENT_SECRET',
] as const;

export class ConfigError extends Error {
  constructor(problems: string[]) {
    super(
      `Configuración inválida del backend (ver backend/.env.example):\n  - ${problems.join('\n  - ')}`,
    );
    this.name = 'ConfigError';
  }
}

export function loadConfig(env: Env): AppConfig {
  const problems: string[] = [];

  for (const key of REQUIRED) {
    if (!env[key]?.trim()) problems.push(`falta ${key}`);
  }
  if (env.JWT_SECRET && env.JWT_SECRET.length < 32) {
    problems.push('JWT_SECRET debe tener al menos 32 caracteres');
  }

  const int = (key: string, def: number, min: number, max: number): number => {
    const raw = env[key]?.trim();
    if (!raw) return def;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < min || n > max) {
      problems.push(`${key} debe ser un entero entre ${min} y ${max}`);
      return def;
    }
    return n;
  };

  const config: AppConfig = {
    port: int('PORT', 3001, 1, 65535),
    jwtSecret: env.JWT_SECRET ?? '',
    jwtExpiresInS: int('JWT_EXPIRES_IN_S', 3600, 60, 7 * 24 * 3600),
    supabaseUrl: env.SUPABASE_URL ?? '',
    supabaseServiceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    ovenbirdUrl: (env.OVENBIRD_URL ?? '').replace(/\/+$/, ''),
    ovenbirdClientId: env.OVENBIRD_CLIENT_ID ?? '',
    ovenbirdClientSecret: env.OVENBIRD_CLIENT_SECRET ?? '',
    embedTokenTtlS: int('EMBED_TOKEN_TTL_S', 900, 60, 3600),
    batteryCapacityMah: int('BATTERY_CAPACITY_MAH', 1000, 1, 100000),
    // Rangos del DP `report_interval_s` de ob.lora.unit (5..3600).
    powerNormalIntervalS: int('POWER_NORMAL_INTERVAL_S', 15, 5, 3600),
    powerSavingIntervalS: int('POWER_SAVING_INTERVAL_S', 150, 5, 3600),
  };

  // El firmware entra en ahorro con intervalo >= 100 s (docs/03).
  if (config.powerNormalIntervalS >= 100) {
    problems.push(
      'POWER_NORMAL_INTERVAL_S debe ser menor a 100 (el collar pasa a ahorro desde 100 s)',
    );
  }
  if (config.powerSavingIntervalS < 100) {
    problems.push(
      'POWER_SAVING_INTERVAL_S debe ser al menos 100 (umbral de ahorro del collar)',
    );
  }

  if (problems.length) throw new ConfigError(problems);
  return config;
}
