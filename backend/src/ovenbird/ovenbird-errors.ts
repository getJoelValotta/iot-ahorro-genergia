import {
  OvenbirdAuthError,
  OvenbirdError,
  OvenbirdNotFoundError,
  OvenbirdRateLimitError,
  OvenbirdValidationError,
} from '@ovenbird/node';
import { ProblemException } from '../common/problem';

/**
 * Traduce cualquier error que salga de `@ovenbird/node` a una respuesta HTTP del contrato
 * (docs/01 §7 regla 6). Nunca copia el mensaje original: puede traer datos internos.
 */
export function translateOvenbirdError(err: unknown): ProblemException {
  if (err instanceof ProblemException) return err;
  if (err instanceof OvenbirdNotFoundError) {
    return new ProblemException(
      404,
      'DEVICE_NOT_FOUND',
      'Dispositivo no encontrado',
      'El dispositivo no existe en la plataforma.',
    );
  }
  if (err instanceof OvenbirdValidationError) {
    return new ProblemException(
      422,
      'OVENBIRD_VALIDATION_ERROR',
      'Pedido rechazado por la plataforma',
      'La plataforma rechazó el pedido para este dispositivo.',
    );
  }
  if (err instanceof OvenbirdRateLimitError) {
    return new ProblemException(
      429,
      'RATE_LIMITED',
      'Demasiados pedidos',
      'La plataforma está recibiendo demasiados pedidos. Probá de nuevo en unos segundos.',
      undefined,
      Math.max(1, Math.ceil((err.retryAfterMs || 1000) / 1000)),
    );
  }
  if (err instanceof OvenbirdAuthError) {
    return new ProblemException(
      502,
      'OVENBIRD_AUTH_ERROR',
      'Error con la plataforma de dispositivos',
      'No pudimos comunicarnos con la plataforma de dispositivos. Probá más tarde.',
    );
  }
  if (err instanceof OvenbirdError && err.status >= 400 && err.status < 500) {
    return new ProblemException(
      502,
      'OVENBIRD_ERROR',
      'Error con la plataforma de dispositivos',
      'La plataforma de dispositivos respondió con un error. Probá más tarde.',
    );
  }
  // Red caída, timeout, 5xx o falla al pedir el token de servidor.
  return new ProblemException(
    503,
    'OVENBIRD_UNAVAILABLE',
    'Plataforma no disponible',
    'La plataforma de dispositivos no está disponible en este momento. Probá en unos minutos.',
    undefined,
    5,
  );
}
