import {
  createTestApp,
  registerUser,
  type TestApp,
} from '../src/testing/test-app';

describe('Auth por HTTP (ticket 02)', () => {
  let t: TestApp;
  beforeAll(async () => (t = await createTestApp()));
  afterAll(() => t.close());

  it('register → 201 AuthToken y el email se guarda en minúsculas', async () => {
    const res = await t
      .http()
      .post('/api/v1/auth/register')
      .send({
        email: '  Ana@Example.COM ',
        password: 'password123',
        name: 'Ana',
        phone: '+54 223',
      })
      .expect(201);
    expect(res.body).toEqual({
      accessToken: expect.any(String),
      tokenType: 'Bearer',
      expiresIn: 3600,
    });
    const me = await t
      .http()
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${res.body.accessToken}`)
      .expect(200);
    expect(me.body).toEqual({
      id: expect.any(String),
      email: 'ana@example.com',
      name: 'Ana',
      phone: '+54 223',
    });
  });

  it('me devuelve phone null si no se cargó y nunca el hash', async () => {
    const { auth } = await registerUser(t);
    const me = await t
      .http()
      .get('/api/v1/auth/me')
      .set('Authorization', auth)
      .expect(200);
    expect(me.body.phone).toBeNull();
    expect(JSON.stringify(me.body)).not.toMatch(/password|hash/i);
  });

  it('email repetido (sin importar mayúsculas) → 409 EMAIL_TAKEN', async () => {
    await registerUser(t, { email: 'dup@example.com' });
    const res = await t
      .http()
      .post('/api/v1/auth/register')
      .send({ email: 'DUP@example.com', password: 'password123', name: 'Otro' })
      .expect(409);
    expect(res.body.code).toBe('EMAIL_TAKEN');
  });

  it('datos inválidos → 400 con errors por campo', async () => {
    const res = await t
      .http()
      .post('/api/v1/auth/register')
      .send({ email: 'no-es-email', password: 'corta', name: '' })
      .expect(400);
    expect(res.headers['content-type']).toMatch(/problem\+json/);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    const fields = (res.body.errors as Array<{ field: string }>).map(
      (e) => e.field,
    );
    expect(fields).toEqual(
      expect.arrayContaining(['email', 'password', 'name']),
    );
  });

  it('login correcto → 200 AuthToken', async () => {
    await registerUser(t, {
      email: 'login@example.com',
      password: 'clave-segura',
    });
    const res = await t
      .http()
      .post('/api/v1/auth/login')
      .send({ email: 'LOGIN@example.com', password: 'clave-segura' })
      .expect(200);
    expect(res.body.tokenType).toBe('Bearer');
  });

  it('login con contraseña o email incorrectos → mismo 401 INVALID_CREDENTIALS', async () => {
    await registerUser(t, {
      email: 'cred@example.com',
      password: 'clave-segura',
    });
    const wrongPass = await t
      .http()
      .post('/api/v1/auth/login')
      .send({ email: 'cred@example.com', password: 'otra-clave' })
      .expect(401);
    const wrongEmail = await t
      .http()
      .post('/api/v1/auth/login')
      .send({ email: 'nadie@example.com', password: 'clave-segura' })
      .expect(401);
    expect(wrongPass.body).toEqual(wrongEmail.body);
    expect(wrongPass.body.code).toBe('INVALID_CREDENTIALS');
  });

  it('me sin token o con token inválido → 401', async () => {
    await t.http().get('/api/v1/auth/me').expect(401);
    await t
      .http()
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer basura')
      .expect(401);
    await t
      .http()
      .get('/api/v1/auth/me')
      .set('Authorization', 'Basic abc')
      .expect(401);
  });

  it('token firmado con otro secreto → 401', async () => {
    // header.payload.firma de un JWT válido en forma pero con firma incorrecta
    const forged =
      'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.c2lnbmF0dXJhLWZhbHNhLWZhbHNhLWZhbHNh';
    await t
      .http()
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${forged}`)
      .expect(401);
  });
});

describe('Auth con token vencido', () => {
  it('un token con vencimiento corto deja de servir', async () => {
    const t = await createTestApp({ JWT_EXPIRES_IN_S: '60' });
    try {
      const { auth } = await registerUser(t);
      const realNow = Date.now;
      Date.now = () => realNow() + 61_000;
      try {
        await t
          .http()
          .get('/api/v1/auth/me')
          .set('Authorization', auth)
          .expect(401);
      } finally {
        Date.now = realNow;
      }
    } finally {
      await t.close();
    }
  });
});
