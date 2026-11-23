import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';

export const IS_PUBLIC = 'isPublic';

/** Marca una ruta como pública (el guard global no pide token). */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Usuario autenticado que el guard deja en el request. */
export type AuthUser = { id: string };

/** Inyecta el usuario autenticado en el handler: `@CurrentUser() user: AuthUser`. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser =>
    ctx.switchToHttp().getRequest<{ user: AuthUser }>().user,
);
