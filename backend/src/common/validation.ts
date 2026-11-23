import { ValidationError, ValidationPipe } from '@nestjs/common';
import { FieldError, Problems } from './problem';

/** Aplana los errores de class-validator a `{ field, message }` (con ruta `a.b` en objetos anidados). */
export function flattenValidationErrors(
  errors: ValidationError[],
  parent = '',
): FieldError[] {
  const out: FieldError[] = [];
  for (const e of errors) {
    const field = parent ? `${parent}.${e.property}` : e.property;
    for (const message of Object.values(e.constraints ?? {})) {
      out.push({ field, message });
    }
    if (e.children?.length)
      out.push(...flattenValidationErrors(e.children, field));
  }
  return out;
}

/**
 * Validación tolerante del contrato: descarta campos desconocidos sin error
 * (`whitelist` + `forbidNonWhitelisted: false`) y convierte tipos (`transform`).
 */
export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: false,
    transform: true,
    exceptionFactory: (errors) =>
      Problems.validation(flattenValidationErrors(errors)),
  });
}
