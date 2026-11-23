import { HttpStatus } from '@nestjs/common';

/** Error de un campo puntual (validación). */
export type FieldError = { field: string; message: string };

/** Cuerpo RFC 9457 que exige el contrato (docs/01 §6). */
export type ProblemBody = {
  type: string;
  title: string;
  status: number;
  detail: string;
  code: string;
  errors?: FieldError[];
};

/**
 * Error de negocio que el filtro global convierte en `application/problem+json`.
 * `detail` siempre es un texto pensado para el usuario: nunca mensajes internos.
 */
export class ProblemException extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly title: string,
    readonly detail: string,
    readonly errors?: FieldError[],
    /** Segundos para el header `Retry-After` (solo 429/503). */
    readonly retryAfterS?: number,
  ) {
    super(`${code}: ${detail}`);
    this.name = 'ProblemException';
  }

  toBody(): ProblemBody {
    const body: ProblemBody = {
      type: `/problems/${this.code.toLowerCase().replace(/_/g, '-')}`,
      title: this.title,
      status: this.status,
      detail: this.detail,
      code: this.code,
    };
    if (this.errors) body.errors = this.errors;
    return body;
  }
}

/** Errores frecuentes, para no repetir textos. */
export const Problems = {
  petNotFound: () =>
    new ProblemException(
      HttpStatus.NOT_FOUND,
      'PET_NOT_FOUND',
      'Mascota no encontrada',
      'La mascota no existe o no pertenece a tu cuenta.',
    ),
  petHasNoDevice: () =>
    new ProblemException(
      HttpStatus.CONFLICT,
      'PET_HAS_NO_DEVICE',
      'La mascota no tiene collar',
      'Vinculá un collar a la mascota antes de usar esta función.',
    ),
  unauthorized: (detail = 'Iniciá sesión para continuar.') =>
    new ProblemException(
      HttpStatus.UNAUTHORIZED,
      'UNAUTHORIZED',
      'No autenticado',
      detail,
    ),
  validation: (errors: FieldError[]) =>
    new ProblemException(
      HttpStatus.BAD_REQUEST,
      'VALIDATION_ERROR',
      'Datos inválidos',
      errors.length === 1
        ? `${errors[0].field}: ${errors[0].message}`
        : 'Revisá los campos marcados.',
      errors,
    ),
};
