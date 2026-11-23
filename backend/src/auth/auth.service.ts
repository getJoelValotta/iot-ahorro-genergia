import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { ProblemException, Problems } from '../common/problem';
import { APP_CONFIG, type AppConfig } from '../config/app-config';
import { EmailTakenError, type UserRecord } from '../database/records';
import { UsersRepository } from '../database/repositories';
import type { AuthTokenDto, LoginDto, RegisterDto, UserDto } from './auth.dto';

const BCRYPT_ROUNDS = 10;
// Hash de una contraseña cualquiera: se compara igual cuando el email no existe, para que el
// tiempo de respuesta no revele qué emails están registrados.
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', BCRYPT_ROUNDS);

export type JwtPayload = { sub: string };

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersRepository,
    private readonly jwt: JwtService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async register(dto: RegisterDto): Promise<AuthTokenDto> {
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    try {
      const user = await this.users.create({
        email: dto.email.trim().toLowerCase(),
        name: dto.name.trim(),
        phone: dto.phone?.trim() || null,
        passwordHash,
      });
      return this.issueToken(user);
    } catch (err) {
      if (err instanceof EmailTakenError) {
        throw new ProblemException(
          HttpStatus.CONFLICT,
          'EMAIL_TAKEN',
          'Email ya registrado',
          'Ya existe una cuenta con ese email.',
        );
      }
      throw err;
    }
  }

  async login(dto: LoginDto): Promise<AuthTokenDto> {
    const user = await this.users.findByEmail(dto.email.trim().toLowerCase());
    const ok = await bcrypt.compare(
      dto.password,
      user?.passwordHash ?? DUMMY_HASH,
    );
    if (!user || !ok) {
      throw new ProblemException(
        HttpStatus.UNAUTHORIZED,
        'INVALID_CREDENTIALS',
        'Credenciales inválidas',
        'El email o la contraseña no son correctos.',
      );
    }
    return this.issueToken(user);
  }

  async me(userId: string): Promise<UserDto> {
    const user = await this.users.findById(userId);
    if (!user) throw Problems.unauthorized('La sesión ya no es válida.');
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
    };
  }

  /** Verifica un token y devuelve el id de usuario, o null si es inválido o venció. */
  async verify(token: string): Promise<string | null> {
    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(token);
      return typeof payload.sub === 'string' ? payload.sub : null;
    } catch {
      return null;
    }
  }

  private async issueToken(user: UserRecord): Promise<AuthTokenDto> {
    const accessToken = await this.jwt.signAsync({
      sub: user.id,
    } satisfies JwtPayload);
    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: this.config.jwtExpiresInS,
    };
  }
}
