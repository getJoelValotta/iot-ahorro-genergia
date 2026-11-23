import { JwtService } from '@nestjs/jwt';
import { ProblemException } from '../common/problem';
import { loadConfig } from '../config/app-config';
import { InMemoryUsersRepository } from '../testing/in-memory-repositories';
import { TEST_ENV } from '../testing/test-app';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const config = loadConfig(TEST_ENV);
  let users: InMemoryUsersRepository;
  let service: AuthService;

  beforeEach(() => {
    users = new InMemoryUsersRepository();
    const jwt = new JwtService({
      secret: config.jwtSecret,
      signOptions: { expiresIn: config.jwtExpiresInS },
    });
    service = new AuthService(users, jwt, config);
  });

  it('registra con contraseña hasheada (nunca en texto plano)', async () => {
    await service.register({
      email: 'ana@example.com',
      password: 'password123',
      name: 'Ana',
    });
    const stored = [...users.rows.values()][0];
    expect(stored.passwordHash).not.toBe('password123');
    expect(stored.passwordHash).toMatch(/^\$2[aby]\$/);
  });

  it('emite un token que identifica al usuario', async () => {
    const token = await service.register({
      email: 'a@x.com',
      password: 'password123',
      name: 'A',
    });
    const userId = await service.verify(token.accessToken);
    expect(await service.me(userId as string)).toMatchObject({
      email: 'a@x.com',
      phone: null,
    });
  });

  it('rechaza email duplicado con EMAIL_TAKEN', async () => {
    await service.register({
      email: 'a@x.com',
      password: 'password123',
      name: 'A',
    });
    await expect(
      service.register({
        email: 'A@X.com',
        password: 'password123',
        name: 'B',
      }),
    ).rejects.toMatchObject({ status: 409, code: 'EMAIL_TAKEN' });
  });

  it('login con credenciales malas da INVALID_CREDENTIALS', async () => {
    await service.register({
      email: 'a@x.com',
      password: 'password123',
      name: 'A',
    });
    await expect(
      service.login({ email: 'a@x.com', password: 'nope-nope' }),
    ).rejects.toBeInstanceOf(ProblemException);
    await expect(
      service.login({ email: 'b@x.com', password: 'password123' }),
    ).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    });
  });

  it('verify devuelve null para tokens inválidos', async () => {
    expect(await service.verify('no.es.jwt')).toBeNull();
  });

  it('me de un usuario borrado da 401', async () => {
    await expect(
      service.me('00000000-0000-4000-8000-000000000000'),
    ).rejects.toMatchObject({
      status: 401,
    });
  });
});
