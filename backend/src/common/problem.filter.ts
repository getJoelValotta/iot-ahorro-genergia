import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { OvenbirdError } from '@ovenbird/node';
import { translateOvenbirdError } from '../ovenbird/ovenbird-errors';
import { ProblemException } from './problem';

const TITLES: Record<number, [code: string, title: string, detail: string]> = {
  400: [
    'BAD_REQUEST',
    'Pedido inválido',
    'El pedido no tiene un formato válido.',
  ],
  401: ['UNAUTHORIZED', 'No autenticado', 'Iniciá sesión para continuar.'],
  403: ['FORBIDDEN', 'Acceso denegado', 'No tenés permiso para esta acción.'],
  404: ['NOT_FOUND', 'No encontrado', 'El recurso pedido no existe.'],
  405: [
    'METHOD_NOT_ALLOWED',
    'Método no permitido',
    'El método no está permitido.',
  ],
  409: [
    'CONFLICT',
    'Conflicto',
    'El pedido entra en conflicto con el estado actual.',
  ],
  413: [
    'PAYLOAD_TOO_LARGE',
    'Pedido demasiado grande',
    'El cuerpo del pedido es demasiado grande.',
  ],
  415: [
    'UNSUPPORTED_MEDIA_TYPE',
    'Formato no soportado',
    'Enviá el cuerpo como JSON.',
  ],
  429: [
    'RATE_LIMITED',
    'Demasiados pedidos',
    'Probá de nuevo en unos segundos.',
  ],
};

/** Convierte una excepción cualquiera en el `ProblemException` que se responde. */
export function toProblem(exception: unknown): ProblemException {
  if (exception instanceof ProblemException) return exception;
  if (exception instanceof OvenbirdError)
    return translateOvenbirdError(exception);
  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    const known = TITLES[status];
    if (known) return new ProblemException(status, ...known);
    if (status < 500) {
      return new ProblemException(
        status,
        'ERROR',
        'Error',
        'No se pudo procesar el pedido.',
      );
    }
  }
  return new ProblemException(
    500,
    'INTERNAL_ERROR',
    'Error interno',
    'Ocurrió un error inesperado. Probá de nuevo más tarde.',
  );
}

/**
 * Filtro global: toda respuesta de error sale en RFC 9457 (`application/problem+json`).
 * Los errores inesperados se registran con su pila, pero al cliente solo le llega un texto genérico.
 */
@Catch()
export class ProblemFilter implements ExceptionFilter {
  private readonly logger = new Logger('HTTP');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const problem = toProblem(exception);

    // Solo método, ruta (sin query) y código: nunca cuerpos, headers ni tokens.
    const where = `${req.method} ${req.path}`;
    if (problem.status >= 500) {
      this.logger.error(
        `${where} -> ${problem.status} ${problem.code}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(`${where} -> ${problem.status} ${problem.code}`);
    }

    if (problem.retryAfterS)
      res.setHeader('Retry-After', String(problem.retryAfterS));
    res
      .status(problem.status)
      .type('application/problem+json')
      .send(JSON.stringify(problem.toBody()));
  }
}
