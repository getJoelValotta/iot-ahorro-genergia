import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../app.module';
import { configureApp } from '../app.setup';
import {
  PairingRepository,
  PetsRepository,
  UsersRepository,
} from '../database/repositories';
import { SUPABASE } from '../database/supabase.repositories';
import { OVENBIRD_CLIENT } from '../ovenbird/ovenbird.gateway';
import { FakeOvenbird } from './fake-ovenbird';
import {
  InMemoryPairingRepository,
  InMemoryPetsRepository,
  InMemoryUsersRepository,
} from './in-memory-repositories';

/** Variables de entorno de prueba (sin secretos reales). */
export const TEST_ENV = {
  NODE_ENV: 'test',
  JWT_SECRET: 'test-secret-de-al-menos-treinta-y-dos-caracteres',
  JWT_EXPIRES_IN_S: '3600',
  SUPABASE_URL: 'http://localhost:54331',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
  OVENBIRD_URL: 'http://ovenbird.invalid',
  OVENBIRD_CLIENT_ID: 'test-client-id',
  OVENBIRD_CLIENT_SECRET: 'test-client-secret-NO-DEBE-SALIR',
};

export type TestApp = {
  app: INestApplication<App>;
  http: () => ReturnType<typeof request>;
  ovenbird: FakeOvenbird;
  users: InMemoryUsersRepository;
  pets: InMemoryPetsRepository;
  pairing: InMemoryPairingRepository;
  close: () => Promise<void>;
};

/**
 * La app Nest completa (mismos módulos, pipes y filtros que producción) con la base en
 * memoria y Ovenbird falso.
 */
export async function createTestApp(
  env: Record<string, string> = {},
): Promise<TestApp> {
  Object.assign(process.env, TEST_ENV, env);
  const ovenbird = new FakeOvenbird();
  const users = new InMemoryUsersRepository();
  const pets = new InMemoryPetsRepository();
  const pairing = new InMemoryPairingRepository();

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(SUPABASE)
    .useValue({})
    .overrideProvider(UsersRepository)
    .useValue(users)
    .overrideProvider(PetsRepository)
    .useValue(pets)
    .overrideProvider(PairingRepository)
    .useValue(pairing)
    .overrideProvider(OVENBIRD_CLIENT)
    .useValue(ovenbird)
    .compile();

  const app = moduleRef.createNestApplication<INestApplication<App>>({
    logger: false,
  });
  configureApp(app);
  await app.init();

  return {
    app,
    http: () => request(app.getHttpServer()),
    ovenbird,
    users,
    pets,
    pairing,
    close: () => app.close(),
  };
}

let counter = 0;

/** Registra un usuario nuevo y devuelve su header de autorización. */
export async function registerUser(
  t: TestApp,
  overrides: Partial<{ email: string; name: string; password: string }> = {},
): Promise<{ auth: string; email: string; userId: string }> {
  counter += 1;
  const email = overrides.email ?? `user${counter}-${Date.now()}@example.com`;
  const res = await t
    .http()
    .post('/api/v1/auth/register')
    .send({
      email,
      name: overrides.name ?? `User ${counter}`,
      password: overrides.password ?? 'password123',
    })
    .expect(201);
  const auth = `Bearer ${(res.body as { accessToken: string }).accessToken}`;
  const me = await t
    .http()
    .get('/api/v1/auth/me')
    .set('Authorization', auth)
    .expect(200);
  return { auth, email, userId: (me.body as { id: string }).id };
}

/** Crea una mascota y devuelve su id. */
export async function createPet(
  t: TestApp,
  auth: string,
  body: Record<string, unknown> = { name: 'Firulais', species: 'dog' },
): Promise<string> {
  const res = await t
    .http()
    .post('/api/v1/pets')
    .set('Authorization', auth)
    .send(body)
    .expect(201);
  return (res.body as { id: string }).id;
}

/** Genera un código para el usuario y hace "aparecer" un dispositivo dentro de su ventana. */
export async function pairDevice(
  t: TestApp,
  auth: string,
  deviceId: string,
): Promise<void> {
  await t
    .http()
    .post('/api/v1/pairing-codes')
    .set('Authorization', auth)
    .send({})
    .expect(201);
  t.ovenbird.addDevice({ deviceId, createdAt: new Date() });
}

/** Empareja un dispositivo y lo vincula a una mascota nueva. Devuelve el id de la mascota. */
export async function petWithDevice(
  t: TestApp,
  auth: string,
  deviceId: string,
): Promise<string> {
  const petId = await createPet(t, auth);
  await pairDevice(t, auth, deviceId);
  await t
    .http()
    .put(`/api/v1/pets/${petId}/device`)
    .set('Authorization', auth)
    .send({ deviceId })
    .expect(200);
  return petId;
}
