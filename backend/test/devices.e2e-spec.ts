import {
  OvenbirdAuthError,
  OvenbirdError,
  OvenbirdNotFoundError,
  OvenbirdRateLimitError,
  OvenbirdValidationError,
} from '@ovenbird/node';
import {
  createPet,
  createTestApp,
  pairDevice,
  petWithDevice,
  registerUser,
  type TestApp,
} from '../src/testing/test-app';

describe('Emparejamiento y dispositivos (ticket 04)', () => {
  let t: TestApp;
  beforeAll(async () => (t = await createTestApp()));
  afterAll(() => t.close());
  afterEach(() => t.ovenbird.clearFailures());

  it('POST /pairing-codes sin body → 201 { code, expiresAt } y registra la ventana', async () => {
    const { auth, userId } = await registerUser(t);
    const res = await t
      .http()
      .post('/api/v1/pairing-codes')
      .set('Authorization', auth)
      .expect(201);
    expect(res.body).toEqual({
      code: expect.any(String),
      expiresAt: expect.stringMatching(/Z$/),
    });
    const sessions = await t.pairing.listByUser(userId);
    expect(sessions.map((s) => s.code)).toContain(res.body.code);
  });

  it('POST /pairing-codes acepta { label } y lo pasa a Ovenbird', async () => {
    const { auth } = await registerUser(t);
    await t
      .http()
      .post('/api/v1/pairing-codes')
      .set('Authorization', auth)
      .send({ label: 'Collar de Rex' })
      .expect(201);
    expect(t.ovenbird.pairingLabels.at(-1)).toBe('Collar de Rex');
  });

  it('GET /devices muestra los libres aparecidos en la ventana del usuario, no los viejos ni los de otros', async () => {
    const a = await registerUser(t);
    const b = await registerUser(t);
    t.ovenbird.addDevice({
      deviceId: 'viejo',
      createdAt: new Date(Date.now() - 3600_000),
      lastSeenAt: new Date(Date.now() - 3600_000),
    });
    await pairDevice(t, a.auth, 'dev-a');

    const listA = await t
      .http()
      .get('/api/v1/devices')
      .set('Authorization', a.auth)
      .expect(200);
    const idsA = listA.body.data.map((d: { deviceId: string }) => d.deviceId);
    expect(idsA).toContain('dev-a');
    expect(idsA).not.toContain('viejo');
    expect(listA.body.meta).toEqual({ page: 1, limit: 20, total: idsA.length });

    // B no generó código: no ve nada.
    const listB = await t
      .http()
      .get('/api/v1/devices')
      .set('Authorization', b.auth)
      .expect(200);
    expect(listB.body.data).toEqual([]);
  });

  it('Device tiene la forma del contrato (lastSeenAt null si nunca se vio)', async () => {
    const { auth } = await registerUser(t);
    await t
      .http()
      .post('/api/v1/pairing-codes')
      .set('Authorization', auth)
      .expect(201);
    t.ovenbird.addDevice({
      deviceId: 'nuevo',
      name: 'OB-1234',
      lastSeenAt: null,
      online: false,
    });
    const res = await t
      .http()
      .get('/api/v1/devices')
      .set('Authorization', auth)
      .expect(200);
    expect(
      res.body.data.find((d: { deviceId: string }) => d.deviceId === 'nuevo'),
    ).toEqual({
      deviceId: 'nuevo',
      name: 'OB-1234',
      productId: 'ob.lora.unit',
      online: false,
      lastSeenAt: null,
      petId: null,
    });
  });

  it('un collar vinculado a otro usuario no aparece aunque esté en mi ventana', async () => {
    const a = await registerUser(t);
    const b = await registerUser(t);
    await petWithDevice(t, a.auth, 'compartido');
    await t
      .http()
      .post('/api/v1/pairing-codes')
      .set('Authorization', b.auth)
      .expect(201);
    const res = await t
      .http()
      .get('/api/v1/devices')
      .set('Authorization', b.auth)
      .expect(200);
    expect(
      res.body.data.map((d: { deviceId: string }) => d.deviceId),
    ).not.toContain('compartido');
  });

  it('recorre todas las páginas del SDK', async () => {
    const { auth } = await registerUser(t);
    await t
      .http()
      .post('/api/v1/pairing-codes')
      .set('Authorization', auth)
      .expect(201);
    for (let i = 0; i < 120; i++)
      t.ovenbird.addDevice({ deviceId: `bulk-${i}` });
    const res = await t
      .http()
      .get('/api/v1/devices?limit=100&page=2')
      .set('Authorization', auth)
      .expect(200);
    expect(res.body.meta.total).toBeGreaterThanOrEqual(120);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  describe('traducción de errores del SDK', () => {
    const cases: Array<[string, Error, number, string]> = [
      [
        'no encontrado',
        new OvenbirdNotFoundError(404, 'not_found', 'x'),
        404,
        'DEVICE_NOT_FOUND',
      ],
      [
        'validación',
        new OvenbirdValidationError(422, 'validation_error', 'x'),
        422,
        'OVENBIRD_VALIDATION_ERROR',
      ],
      [
        'rate limit',
        new OvenbirdRateLimitError(429, 'rate_limited', 'x', 3000),
        429,
        'RATE_LIMITED',
      ],
      [
        'auth',
        new OvenbirdAuthError(401, 'invalid_client', 'secret=abc'),
        502,
        'OVENBIRD_AUTH_ERROR',
      ],
      [
        '5xx',
        new OvenbirdError(503, 'unavailable', 'x'),
        503,
        'OVENBIRD_UNAVAILABLE',
      ],
      [
        'red',
        new OvenbirdError(0, 'network_error', 'ECONNREFUSED 10.0.0.1'),
        503,
        'OVENBIRD_UNAVAILABLE',
      ],
      [
        'token del servidor',
        new Error('token 500'),
        503,
        'OVENBIRD_UNAVAILABLE',
      ],
    ];

    it.each(cases)(
      '%s → %i %s en problem+json, sin detalles internos',
      async (_n, err, status, code) => {
        const { auth } = await registerUser(t);
        t.ovenbird.failWith(err);
        for (const req of [
          t.http().post('/api/v1/pairing-codes'),
          t.http().get('/api/v1/devices'),
        ]) {
          const res = await req.set('Authorization', auth);
          expect(res.status).toBe(status);
          expect(res.headers['content-type']).toMatch(/problem\+json/);
          expect(res.body.code).toBe(code);
          expect(JSON.stringify(res.body)).not.toMatch(
            /secret|ECONNREFUSED|10\.0\.0\.1|token 500/,
          );
        }
      },
    );

    it('429 incluye Retry-After', async () => {
      const { auth } = await registerUser(t);
      t.ovenbird.failWith(
        new OvenbirdRateLimitError(429, 'rate_limited', 'x', 3000),
      );
      const res = await t
        .http()
        .get('/api/v1/devices')
        .set('Authorization', auth)
        .expect(429);
      expect(res.headers['retry-after']).toBe('3');
    });
  });
});

describe('Vincular y desvincular collar (ticket 05)', () => {
  let t: TestApp;
  beforeAll(async () => (t = await createTestApp()));
  afterAll(() => t.close());

  it('PUT vincula → 200 Pet con deviceId y GET /devices muestra el petId', async () => {
    const { auth } = await registerUser(t);
    const petId = await createPet(t, auth);
    await pairDevice(t, auth, 'd1');
    const res = await t
      .http()
      .put(`/api/v1/pets/${petId}/device`)
      .set('Authorization', auth)
      .send({ deviceId: 'd1' })
      .expect(200);
    expect(res.body).toMatchObject({ id: petId, deviceId: 'd1' });
    const list = await t
      .http()
      .get('/api/v1/devices')
      .set('Authorization', auth)
      .expect(200);
    expect(
      list.body.data.find((d: { deviceId: string }) => d.deviceId === 'd1')
        .petId,
    ).toBe(petId);
  });

  it('mismo collar a la misma mascota → 200 idempotente', async () => {
    const { auth } = await registerUser(t);
    const petId = await petWithDevice(t, auth, 'd2');
    await t
      .http()
      .put(`/api/v1/pets/${petId}/device`)
      .set('Authorization', auth)
      .send({ deviceId: 'd2' })
      .expect(200);
  });

  it('collar en otra mascota → 409 DEVICE_ALREADY_LINKED', async () => {
    const { auth } = await registerUser(t);
    await petWithDevice(t, auth, 'd3');
    const other = await createPet(t, auth, { name: 'Otro', species: 'cat' });
    const res = await t
      .http()
      .put(`/api/v1/pets/${other}/device`)
      .set('Authorization', auth)
      .send({ deviceId: 'd3' })
      .expect(409);
    expect(res.body.code).toBe('DEVICE_ALREADY_LINKED');
  });

  it('mascota con otro collar → 409 PET_ALREADY_HAS_DEVICE', async () => {
    const { auth } = await registerUser(t);
    const petId = await petWithDevice(t, auth, 'd4');
    await pairDevice(t, auth, 'd5');
    const res = await t
      .http()
      .put(`/api/v1/pets/${petId}/device`)
      .set('Authorization', auth)
      .send({ deviceId: 'd5' })
      .expect(409);
    expect(res.body.code).toBe('PET_ALREADY_HAS_DEVICE');
  });

  it('dispositivo que el usuario no puede ver → 404 DEVICE_NOT_FOUND', async () => {
    const { auth } = await registerUser(t);
    const petId = await createPet(t, auth);
    t.ovenbird.addDevice({
      deviceId: 'ajeno',
      createdAt: new Date(Date.now() - 3600_000),
    });
    for (const deviceId of ['ajeno', 'inexistente']) {
      const res = await t
        .http()
        .put(`/api/v1/pets/${petId}/device`)
        .set('Authorization', auth)
        .send({ deviceId })
        .expect(404);
      expect(res.body.code).toBe('DEVICE_NOT_FOUND');
    }
  });

  it('sin deviceId → 400 con errors', async () => {
    const { auth } = await registerUser(t);
    const petId = await createPet(t, auth);
    const res = await t
      .http()
      .put(`/api/v1/pets/${petId}/device`)
      .set('Authorization', auth)
      .send({})
      .expect(400);
    expect(res.body.errors[0].field).toBe('deviceId');
  });

  it('mascota ajena → 404 PET_NOT_FOUND al vincular y desvincular', async () => {
    const owner = await registerUser(t);
    const intruder = await registerUser(t);
    const petId = await petWithDevice(t, owner.auth, 'd6');
    await pairDevice(t, intruder.auth, 'd7');
    const put = await t
      .http()
      .put(`/api/v1/pets/${petId}/device`)
      .set('Authorization', intruder.auth)
      .send({ deviceId: 'd7' })
      .expect(404);
    expect(put.body.code).toBe('PET_NOT_FOUND');
    const del = await t
      .http()
      .delete(`/api/v1/pets/${petId}/device`)
      .set('Authorization', intruder.auth)
      .expect(404);
    expect(del.body.code).toBe('PET_NOT_FOUND');
  });

  it('DELETE desvincula → 204 y el collar queda libre para otra mascota', async () => {
    const { auth } = await registerUser(t);
    const petId = await petWithDevice(t, auth, 'd8');
    await t
      .http()
      .delete(`/api/v1/pets/${petId}/device`)
      .set('Authorization', auth)
      .expect(204);
    const pet = await t
      .http()
      .get(`/api/v1/pets/${petId}`)
      .set('Authorization', auth)
      .expect(200);
    expect(pet.body.deviceId).toBeNull();
    const other = await createPet(t, auth, { name: 'Nuevo', species: 'other' });
    await t
      .http()
      .put(`/api/v1/pets/${other}/device`)
      .set('Authorization', auth)
      .send({ deviceId: 'd8' })
      .expect(200);
  });

  it('borrar la mascota libera su collar (petId null en GET /devices)', async () => {
    const { auth } = await registerUser(t);
    const petId = await petWithDevice(t, auth, 'd9');
    await t
      .http()
      .delete(`/api/v1/pets/${petId}`)
      .set('Authorization', auth)
      .expect(204);
    const list = await t
      .http()
      .get('/api/v1/devices')
      .set('Authorization', auth)
      .expect(200);
    expect(
      list.body.data.find((d: { deviceId: string }) => d.deviceId === 'd9')
        .petId,
    ).toBeNull();
  });
});
