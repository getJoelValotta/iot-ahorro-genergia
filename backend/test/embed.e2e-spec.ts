import { OvenbirdError } from '@ovenbird/node';
import {
  createPet,
  createTestApp,
  petWithDevice,
  registerUser,
  type TestApp,
} from '../src/testing/test-app';

describe('POST /embed-token (ticket 06)', () => {
  let t: TestApp;
  beforeAll(async () => (t = await createTestApp()));
  afterAll(() => t.close());
  afterEach(() => t.ovenbird.clearFailures());

  it('sin parámetros usa todos los collares del usuario con ttl 900 por defecto', async () => {
    const { auth } = await registerUser(t);
    await petWithDevice(t, auth, 'e1');
    await petWithDevice(t, auth, 'e2');
    const res = await t
      .http()
      .post('/api/v1/embed-token')
      .set('Authorization', auth)
      .send({})
      .expect(200);
    expect(res.body).toEqual({
      token: expect.any(String),
      expiresAt: expect.stringMatching(/Z$/),
    });
    expect(t.ovenbird.embedRequests.at(-1)).toEqual({
      deviceIds: ['e1', 'e2'],
      ttlS: 900,
    });
  });

  it('sin collares → 409 NO_LINKED_DEVICES', async () => {
    const { auth } = await registerUser(t);
    await createPet(t, auth);
    const res = await t
      .http()
      .post('/api/v1/embed-token')
      .set('Authorization', auth)
      .send({})
      .expect(409);
    expect(res.body.code).toBe('NO_LINKED_DEVICES');
  });

  it('con petId propio usa solo ese collar', async () => {
    const { auth } = await registerUser(t);
    const petId = await petWithDevice(t, auth, 'e3');
    await petWithDevice(t, auth, 'e4');
    await t
      .http()
      .post('/api/v1/embed-token')
      .set('Authorization', auth)
      .send({ petId })
      .expect(200);
    expect(t.ovenbird.embedRequests.at(-1)?.deviceIds).toEqual(['e3']);
  });

  it('petId ajeno → 404 PET_NOT_FOUND', async () => {
    const owner = await registerUser(t);
    const other = await registerUser(t);
    const petId = await petWithDevice(t, owner.auth, 'e5');
    await petWithDevice(t, other.auth, 'e6');
    const res = await t
      .http()
      .post('/api/v1/embed-token')
      .set('Authorization', other.auth)
      .send({ petId })
      .expect(404);
    expect(res.body.code).toBe('PET_NOT_FOUND');
  });

  it('deviceIds ajenos o inexistentes → el mismo 403', async () => {
    const owner = await registerUser(t);
    const other = await registerUser(t);
    await petWithDevice(t, owner.auth, 'e7');
    await petWithDevice(t, other.auth, 'e8');
    const ajeno = await t
      .http()
      .post('/api/v1/embed-token')
      .set('Authorization', other.auth)
      .send({ deviceIds: ['e7'] })
      .expect(403);
    const inexistente = await t
      .http()
      .post('/api/v1/embed-token')
      .set('Authorization', other.auth)
      .send({ deviceIds: ['nada'] })
      .expect(403);
    expect(ajeno.body).toEqual(inexistente.body);
  });

  it('deviceIds propios → 200 con esos ids', async () => {
    const { auth } = await registerUser(t);
    await petWithDevice(t, auth, 'e9');
    await t
      .http()
      .post('/api/v1/embed-token')
      .set('Authorization', auth)
      .send({ deviceIds: ['e9'] })
      .expect(200);
    expect(t.ovenbird.embedRequests.at(-1)?.deviceIds).toEqual(['e9']);
  });

  it('ttlS se respeta y se recorta a 60..3600 (contrato tolerante)', async () => {
    const { auth } = await registerUser(t);
    await petWithDevice(t, auth, 'e10');
    await t
      .http()
      .post('/api/v1/embed-token')
      .set('Authorization', auth)
      .send({ ttlS: 120 })
      .expect(200);
    expect(t.ovenbird.embedRequests.at(-1)?.ttlS).toBe(120);
    await t
      .http()
      .post('/api/v1/embed-token')
      .set('Authorization', auth)
      .send({ ttlS: 99999 })
      .expect(200);
    expect(t.ovenbird.embedRequests.at(-1)?.ttlS).toBe(3600);
    await t
      .http()
      .post('/api/v1/embed-token')
      .set('Authorization', auth)
      .send({ ttlS: 10 })
      .expect(200);
    expect(t.ovenbird.embedRequests.at(-1)?.ttlS).toBe(60);
    await t
      .http()
      .post('/api/v1/embed-token')
      .set('Authorization', auth)
      .send({ ttlS: 'x' })
      .expect(400);
  });

  it('nunca devuelve el clientSecret y Ovenbird caído → 503', async () => {
    const { auth } = await registerUser(t);
    await petWithDevice(t, auth, 'e11');
    const ok = await t
      .http()
      .post('/api/v1/embed-token')
      .set('Authorization', auth)
      .send({})
      .expect(200);
    expect(JSON.stringify(ok.body)).not.toContain('NO-DEBE-SALIR');
    t.ovenbird.failWith(new OvenbirdError(500, 'internal', 'x'), 'embed');
    const res = await t
      .http()
      .post('/api/v1/embed-token')
      .set('Authorization', auth)
      .send({})
      .expect(503);
    expect(res.body.code).toBe('OVENBIRD_UNAVAILABLE');
  });

  it('sin token → 401', async () => {
    await t.http().post('/api/v1/embed-token').send({}).expect(401);
  });
});
