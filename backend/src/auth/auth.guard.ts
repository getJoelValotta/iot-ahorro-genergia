import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { type AuthUser, IS_PUBLIC } from '../common/auth-user';
import { Problems } from '../common/problem';
import { AuthService } from './auth.service';

/** Guard global: todo pide `Authorization: Bearer <jwt>` salvo lo marcado con `@Public()`. */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const [scheme, token] = (req.headers.authorization ?? '').split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      throw Problems.unauthorized();
    }
    const userId = await this.auth.verify(token);
    if (!userId)
      throw Problems.unauthorized('La sesión no es válida o venció.');
    req.user = { id: userId };
    return true;
  }
}
