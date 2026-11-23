import {
  createTestApp,
  registerUser,
  type TestApp,
} from '../src/testing/test-app';

describe('Infraestructura HTTP (ticket 01)', () => {
  let t: TestApp;
  beforeAll(async () => (t = await createTestApp()));
  afterAll(() => t.close());

  it('GET /capabilities es pública y anuncia solo power-saving', async () => {
    const res = await t.http().get('/api/v1/capabilities').expect(200);
    expect(res.body).toEqual({ apiVersion: '1', variants: ['power-saving'] });
  });

  it('una ruta inexistente da 404 en problem+json', async () => {
    const res = await t.http().get('/api/v1/no-existe').expect(404);
    expect(res.headers['content-type']).toMatch(/application\/problem\+json/);
    expect(res.body).toEqual({
      type: expect.any(String),
      title: expect.any(String),
      status: 404,
      detail: expect.any(String),
      code: 'NOT_FOUND',
    });
    // Nunca el mensaje interno de Express ("Cannot GET ...").
    expect(JSON.stringify(res.body)).not.toMatch(/Cannot GET/);
  });

  it('las rutas de variantes de otros grupos responden 404', async () => {
    const { auth } = await registerUser(t);
    for (const path of [
      '/api/v1/pets/x/lost',
      '/api/v1/pets/x/find-me',
      '/api/v1/zones',
    ]) {
      const res = await t.http().post(path).set('Authorization', auth).send({});
      expect(res.status).toBe(404);
      expect(res.headers['content-type']).toMatch(/problem\+json/);
    }
  });

  it('la validación descarta campos desconocidos sin dar 400', async () => {
    const { auth } = await registerUser(t);
    const res = await t
      .http()
      .post('/api/v1/pets')
      .set('Authorization', auth)
      .send({ name: 'Michi', species: 'cat', color: 'negro', ownerId: 'hack' })
      .expect(201);
    expect(res.body).not.toHaveProperty('color');
    expect(res.body).not.toHaveProperty('ownerId');
  });

  it('un JSON mal formado da 400 en problem+json sin detalles del parser', async () => {
    const res = await t
      .http()
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email":')
      .expect(400);
    expect(res.headers['content-type']).toMatch(/problem\+json/);
    expect(res.body.code).toBe('BAD_REQUEST');
    expect(JSON.stringify(res.body)).not.toMatch(/Unexpected|JSON at position/);
  });

  it('una ruta protegida sin token da 401 en problem+json', async () => {
    const res = await t.http().get('/api/v1/pets').expect(401);
    expect(res.headers['content-type']).toMatch(/problem\+json/);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('CORS abierto', async () => {
    const res = await t
      .http()
      .options('/api/v1/pets')
      .set('Origin', 'http://otro-grupo.example')
      .set('Access-Control-Request-Method', 'GET');
    expect(res.headers['access-control-allow-origin']).toBe('*');
  });

  it('Swagger publica el JSON y marca las rutas de la variante con x-variant', async () => {
    await t.http().get('/api/docs').expect(200);
    const res = await t.http().get('/api/docs-json').expect(200);
    const paths = res.body.paths as Record<
      string,
      Record<string, Record<string, unknown>>
    >;
    expect(paths['/api/v1/capabilities']).toBeDefined();
    expect(paths['/api/v1/pets/{petId}/power'].get['x-variant']).toBe(
      'power-saving',
    );
    expect(paths['/api/v1/pets/{petId}/power'].put['x-variant']).toBe(
      'power-saving',
    );
    expect(paths['/api/v1/pets'].get['x-variant']).toBeUndefined();
  });

  it('ninguna respuesta incluye el clientSecret de Ovenbird', async () => {
    const res = await t.http().get('/api/docs-json').expect(200);
    expect(JSON.stringify(res.body)).not.toContain('NO-DEBE-SALIR');
  });
});
