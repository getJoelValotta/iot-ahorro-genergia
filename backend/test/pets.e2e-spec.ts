import {
  createPet,
  createTestApp,
  registerUser,
  type TestApp,
} from '../src/testing/test-app';

describe('Mascotas por HTTP (ticket 03)', () => {
  let t: TestApp;
  beforeAll(async () => (t = await createTestApp()));
  afterAll(() => t.close());

  it('alta con solo nombre y especie → 201 Pet con opcionales en null', async () => {
    const { auth } = await registerUser(t);
    const res = await t
      .http()
      .post('/api/v1/pets')
      .set('Authorization', auth)
      .send({ name: 'Firulais', species: 'Dog' })
      .expect(201);
    expect(res.body).toEqual({
      id: expect.any(String),
      name: 'Firulais',
      species: 'dog',
      breed: null,
      birthDate: null,
      photoUrl: null,
      deviceId: null,
      createdAt: expect.stringMatching(/Z$/),
      updatedAt: expect.stringMatching(/Z$/),
    });
  });

  it('alta con opcionales; birthDate ISO completo se guarda como fecha', async () => {
    const { auth } = await registerUser(t);
    const res = await t
      .http()
      .post('/api/v1/pets')
      .set('Authorization', auth)
      .send({
        name: 'Michi',
        species: 'cat',
        breed: 'Siamés',
        birthDate: '2020-05-10T12:00:00Z',
        photoUrl: 'https://example.com/michi.jpg',
      })
      .expect(201);
    expect(res.body).toMatchObject({
      breed: 'Siamés',
      birthDate: '2020-05-10',
      photoUrl: 'https://example.com/michi.jpg',
    });
  });

  it('inválido → 400 con errors por campo', async () => {
    const { auth } = await registerUser(t);
    const res = await t
      .http()
      .post('/api/v1/pets')
      .set('Authorization', auth)
      .send({ species: 'dragon', birthDate: 'ayer', photoUrl: 'no-es-url' })
      .expect(400);
    const fields = (res.body.errors as Array<{ field: string }>).map(
      (e) => e.field,
    );
    expect(fields).toEqual(
      expect.arrayContaining(['name', 'species', 'birthDate', 'photoUrl']),
    );
  });

  it('listado paginado con meta y solo las del usuario', async () => {
    const a = await registerUser(t);
    const b = await registerUser(t);
    for (let i = 0; i < 5; i++)
      await createPet(t, a.auth, { name: `A${i}`, species: 'dog' });
    await createPet(t, b.auth, { name: 'B0', species: 'cat' });

    const p1 = await t
      .http()
      .get('/api/v1/pets?page=1&limit=2')
      .set('Authorization', a.auth)
      .expect(200);
    expect(p1.body.meta).toEqual({ page: 1, limit: 2, total: 5 });
    expect(p1.body.data.map((p: { name: string }) => p.name)).toEqual([
      'A0',
      'A1',
    ]);

    const p3 = await t
      .http()
      .get('/api/v1/pets?page=3&limit=2')
      .set('Authorization', a.auth)
      .expect(200);
    expect(p3.body.data.map((p: { name: string }) => p.name)).toEqual(['A4']);

    const def = await t
      .http()
      .get('/api/v1/pets')
      .set('Authorization', a.auth)
      .expect(200);
    expect(def.body.meta).toEqual({ page: 1, limit: 20, total: 5 });
    expect(def.body.data.some((p: { name: string }) => p.name === 'B0')).toBe(
      false,
    );
  });

  it('limit fuera de 1..100 → 400', async () => {
    const { auth } = await registerUser(t);
    await t
      .http()
      .get('/api/v1/pets?limit=0')
      .set('Authorization', auth)
      .expect(400);
    await t
      .http()
      .get('/api/v1/pets?limit=101')
      .set('Authorization', auth)
      .expect(400);
    await t
      .http()
      .get('/api/v1/pets?page=abc')
      .set('Authorization', auth)
      .expect(400);
  });

  it('GET, PATCH parcial y DELETE de la propia mascota', async () => {
    const { auth } = await registerUser(t);
    const id = await createPet(t, auth, {
      name: 'Rex',
      species: 'dog',
      breed: 'Mestizo',
    });

    await t
      .http()
      .get(`/api/v1/pets/${id}`)
      .set('Authorization', auth)
      .expect(200);

    const patched = await t
      .http()
      .patch(`/api/v1/pets/${id}`)
      .set('Authorization', auth)
      .send({ name: 'Rex II', breed: null })
      .expect(200);
    expect(patched.body).toMatchObject({
      name: 'Rex II',
      species: 'dog',
      breed: null,
    });

    await t
      .http()
      .patch(`/api/v1/pets/${id}`)
      .set('Authorization', auth)
      .send({ name: null })
      .expect(400);

    await t
      .http()
      .delete(`/api/v1/pets/${id}`)
      .set('Authorization', auth)
      .expect(204);
    const gone = await t
      .http()
      .get(`/api/v1/pets/${id}`)
      .set('Authorization', auth)
      .expect(404);
    expect(gone.body.code).toBe('PET_NOT_FOUND');
  });

  it('aislamiento: la mascota de otro usuario se comporta como inexistente (404, nunca 403)', async () => {
    const owner = await registerUser(t);
    const intruder = await registerUser(t);
    const id = await createPet(t, owner.auth);

    for (const req of [
      t.http().get(`/api/v1/pets/${id}`),
      t.http().patch(`/api/v1/pets/${id}`).send({ name: 'Robado' }),
      t.http().delete(`/api/v1/pets/${id}`),
    ]) {
      const res = await req.set('Authorization', intruder.auth);
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('PET_NOT_FOUND');
    }
    const still = await t
      .http()
      .get(`/api/v1/pets/${id}`)
      .set('Authorization', owner.auth)
      .expect(200);
    expect(still.body.name).toBe('Firulais');
  });

  it('un id que no es UUID da 404 PET_NOT_FOUND', async () => {
    const { auth } = await registerUser(t);
    const res = await t
      .http()
      .get('/api/v1/pets/123')
      .set('Authorization', auth)
      .expect(404);
    expect(res.body.code).toBe('PET_NOT_FOUND');
  });
});
