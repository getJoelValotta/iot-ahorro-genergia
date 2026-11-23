import { OvenbirdError, OvenbirdNotFoundError } from '@ovenbird/node';
import {
  createPet,
  createTestApp,
  petWithDevice,
  registerUser,
  type TestApp,
} from '../src/testing/test-app';

describe('Variante power-saving (tickets 07 y 08)', () => {
  let t: TestApp;
  beforeAll(async () => (t = await createTestApp()));
  afterAll(() => t.close());
  afterEach(() => {
    t.ovenbird.clearFailures();
    t.ovenbird.initialCommandStatus = 'pending';
  });

  it('GET de una mascota con collar: modo normal, sin comando y estimaciones por modo', async () => {
    const { auth } = await registerUser(t);
    const petId = await petWithDevice(t, auth, 'p1');
    t.ovenbird.setBattery('p1', 80);
    const res = await t
      .http()
      .get(`/api/v1/pets/${petId}/power`)
      .set('Authorization', auth)
      .expect(200);
    expect(res.body).toEqual({
      mode: 'normal',
      reportIntervalS: 15,
      command: { status: 'none', commandId: null, requestedAt: null },
      batteryPct: 80,
      batteryCapacityMah: 1000,
      estimates: {
        normal: {
          avgCurrentMa: expect.any(Number),
          hoursFull: expect.any(Number),
          hoursRemaining: expect.any(Number),
        },
        saving: {
          avgCurrentMa: expect.any(Number),
          hoursFull: expect.any(Number),
          hoursRemaining: expect.any(Number),
        },
      },
    });
    expect(res.body.estimates.saving.hoursFull).toBeGreaterThan(
      res.body.estimates.normal.hoursFull,
    );
    expect(res.body.estimates.normal.hoursRemaining).toBeCloseTo(
      res.body.estimates.normal.hoursFull * 0.8,
      0,
    );
  });

  it('sin dato de batería → batteryPct y horas restantes en null', async () => {
    const { auth } = await registerUser(t);
    const petId = await petWithDevice(t, auth, 'p2');
    const res = await t
      .http()
      .get(`/api/v1/pets/${petId}/power`)
      .set('Authorization', auth)
      .expect(200);
    expect(res.body.batteryPct).toBeNull();
    expect(res.body.estimates.normal.hoursRemaining).toBeNull();
    expect(res.body.estimates.saving.hoursFull).toBeGreaterThan(0);
  });

  it('mascota ajena → 404 y sin collar → 409 PET_HAS_NO_DEVICE', async () => {
    const owner = await registerUser(t);
    const other = await registerUser(t);
    const petId = await petWithDevice(t, owner.auth, 'p3');
    const nf = await t
      .http()
      .get(`/api/v1/pets/${petId}/power`)
      .set('Authorization', other.auth)
      .expect(404);
    expect(nf.body.code).toBe('PET_NOT_FOUND');
    const put = await t
      .http()
      .put(`/api/v1/pets/${petId}/power`)
      .set('Authorization', other.auth)
      .send({ mode: 'saving' })
      .expect(404);
    expect(put.body.code).toBe('PET_NOT_FOUND');

    const bare = await createPet(t, owner.auth);
    for (const req of [
      t.http().get(`/api/v1/pets/${bare}/power`),
      t.http().put(`/api/v1/pets/${bare}/power`).send({ mode: 'saving' }),
    ]) {
      const res = await req.set('Authorization', owner.auth);
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('PET_HAS_NO_DEVICE');
    }
  });

  it('PUT saving envía report_interval_s 150 y responde 202 pending', async () => {
    const { auth } = await registerUser(t);
    const petId = await petWithDevice(t, auth, 'p4');
    const res = await t
      .http()
      .put(`/api/v1/pets/${petId}/power`)
      .set('Authorization', auth)
      .send({ mode: 'saving' })
      .expect(202);
    expect(t.ovenbird.sentCommands.at(-1)).toMatchObject({
      deviceId: 'p4',
      dps: { report_interval_s: 150 },
    });
    expect(res.body).toMatchObject({
      mode: 'saving',
      reportIntervalS: 150,
      command: {
        status: 'pending',
        commandId: expect.any(String),
        requestedAt: expect.stringMatching(/Z$/),
      },
    });
  });

  it('PUT normal envía report_interval_s 15', async () => {
    const { auth } = await registerUser(t);
    const petId = await petWithDevice(t, auth, 'p5');
    await t
      .http()
      .put(`/api/v1/pets/${petId}/power`)
      .set('Authorization', auth)
      .send({ mode: 'normal' })
      .expect(202);
    expect(t.ovenbird.sentCommands.at(-1)?.dps).toEqual({
      report_interval_s: 15,
    });
  });

  it('GET reconcilia pending → confirmed cuando el collar confirma', async () => {
    const { auth } = await registerUser(t);
    const petId = await petWithDevice(t, auth, 'p6');
    const put = await t
      .http()
      .put(`/api/v1/pets/${petId}/power`)
      .set('Authorization', auth)
      .send({ mode: 'saving' })
      .expect(202);
    const commandId = put.body.command.commandId as string;

    const still = await t
      .http()
      .get(`/api/v1/pets/${petId}/power`)
      .set('Authorization', auth)
      .expect(200);
    expect(still.body.command.status).toBe('pending');

    t.ovenbird.setCommandStatus(commandId, 'acked');
    const done = await t
      .http()
      .get(`/api/v1/pets/${petId}/power`)
      .set('Authorization', auth)
      .expect(200);
    expect(done.body.command).toMatchObject({ status: 'confirmed', commandId });
    expect(done.body.mode).toBe('saving');
  });

  it.each(['failed', 'expired'] as const)(
    'GET reconcilia pending → failed si el comando queda %s',
    async (status) => {
      const { auth } = await registerUser(t);
      const petId = await petWithDevice(t, auth, `p7-${status}`);
      const put = await t
        .http()
        .put(`/api/v1/pets/${petId}/power`)
        .set('Authorization', auth)
        .send({ mode: 'saving' })
        .expect(202);
      t.ovenbird.setCommandStatus(put.body.command.commandId as string, status);
      const res = await t
        .http()
        .get(`/api/v1/pets/${petId}/power`)
        .set('Authorization', auth)
        .expect(200);
      expect(res.body.command.status).toBe('failed');
    },
  );

  it('dispositivo que confirma al instante (virtual) → 202 confirmed', async () => {
    const { auth } = await registerUser(t);
    const petId = await petWithDevice(t, auth, 'p8');
    t.ovenbird.initialCommandStatus = 'acked';
    const res = await t
      .http()
      .put(`/api/v1/pets/${petId}/power`)
      .set('Authorization', auth)
      .send({ mode: 'saving' })
      .expect(202);
    expect(res.body.command.status).toBe('confirmed');
  });

  it('el modo elegido se recuerda en un login nuevo', async () => {
    const { auth, email } = await registerUser(t, { password: 'password123' });
    const petId = await petWithDevice(t, auth, 'p9');
    await t
      .http()
      .put(`/api/v1/pets/${petId}/power`)
      .set('Authorization', auth)
      .send({ mode: 'saving' })
      .expect(202);
    const login = await t
      .http()
      .post('/api/v1/auth/login')
      .send({ email, password: 'password123' })
      .expect(200);
    const res = await t
      .http()
      .get(`/api/v1/pets/${petId}/power`)
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(200);
    expect(res.body.mode).toBe('saving');
  });

  it('mode inválido → 400 con errors', async () => {
    const { auth } = await registerUser(t);
    const petId = await petWithDevice(t, auth, 'p10');
    const res = await t
      .http()
      .put(`/api/v1/pets/${petId}/power`)
      .set('Authorization', auth)
      .send({ mode: 'turbo' })
      .expect(400);
    expect(res.body.errors[0].field).toBe('mode');
  });

  it('Ovenbird caído → 503 y no se pierde el modo anterior', async () => {
    const { auth } = await registerUser(t);
    const petId = await petWithDevice(t, auth, 'p11');
    t.ovenbird.failWith(new OvenbirdError(0, 'network_error', 'x'), 'send');
    const res = await t
      .http()
      .put(`/api/v1/pets/${petId}/power`)
      .set('Authorization', auth)
      .send({ mode: 'saving' })
      .expect(503);
    expect(res.body.code).toBe('OVENBIRD_UNAVAILABLE');
    t.ovenbird.clearFailures();
    const get = await t
      .http()
      .get(`/api/v1/pets/${petId}/power`)
      .set('Authorization', auth)
      .expect(200);
    expect(get.body.mode).toBe('normal');
    expect(get.body.command.status).toBe('none');
  });

  it('PUT ya enviado no da error si después falla leer la batería (202, batteryPct null)', async () => {
    const { auth } = await registerUser(t);
    const petId = await petWithDevice(t, auth, 'p15');
    t.ovenbird.failWith(new OvenbirdError(502, 'bad_gateway', 'x'), 'status');
    const res = await t
      .http()
      .put(`/api/v1/pets/${petId}/power`)
      .set('Authorization', auth)
      .send({ mode: 'saving' })
      .expect(202);
    expect(res.body.mode).toBe('saving');
    expect(res.body.command.status).toBe('pending');
    expect(res.body.batteryPct).toBeNull();
    t.ovenbird.clearFailures();
  });

  it('GET con un comando que Ovenbird ya no tiene (404) lo marca failed en vez de dar error', async () => {
    const { auth } = await registerUser(t);
    const petId = await petWithDevice(t, auth, 'p16');
    await t
      .http()
      .put(`/api/v1/pets/${petId}/power`)
      .set('Authorization', auth)
      .send({ mode: 'saving' })
      .expect(202);
    t.ovenbird.failWith(
      new OvenbirdNotFoundError(404, 'not_found', 'command'),
      'getCommand',
    );
    const res = await t
      .http()
      .get(`/api/v1/pets/${petId}/power`)
      .set('Authorization', auth)
      .expect(200);
    expect(res.body.command.status).toBe('failed');
    t.ovenbird.clearFailures();
  });

  it('GET con Ovenbird caído → 503', async () => {
    const { auth } = await registerUser(t);
    const petId = await petWithDevice(t, auth, 'p12');
    t.ovenbird.failWith(new OvenbirdError(502, 'bad_gateway', 'x'), 'status');
    await t
      .http()
      .get(`/api/v1/pets/${petId}/power`)
      .set('Authorization', auth)
      .expect(503);
  });

  it('vincular un collar nuevo reinicia el estado de ahorro', async () => {
    const { auth } = await registerUser(t);
    const petId = await petWithDevice(t, auth, 'p13');
    await t
      .http()
      .put(`/api/v1/pets/${petId}/power`)
      .set('Authorization', auth)
      .send({ mode: 'saving' })
      .expect(202);
    await t
      .http()
      .delete(`/api/v1/pets/${petId}/device`)
      .set('Authorization', auth)
      .expect(204);
    await t
      .http()
      .post('/api/v1/pairing-codes')
      .set('Authorization', auth)
      .expect(201);
    t.ovenbird.addDevice({ deviceId: 'p14', createdAt: new Date() });
    await t
      .http()
      .put(`/api/v1/pets/${petId}/device`)
      .set('Authorization', auth)
      .send({ deviceId: 'p14' })
      .expect(200);
    const res = await t
      .http()
      .get(`/api/v1/pets/${petId}/power`)
      .set('Authorization', auth)
      .expect(200);
    expect(res.body).toMatchObject({
      mode: 'normal',
      command: { status: 'none' },
    });
  });
});
