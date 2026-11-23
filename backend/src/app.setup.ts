import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ProblemFilter } from './common/problem.filter';
import { createValidationPipe } from './common/validation';

/**
 * Infraestructura HTTP del contrato (docs/01 §5). La usan `main.ts`, el handler de Vercel
 * y los tests, así todos prueban exactamente la misma app.
 */
export function configureApp(app: INestApplication): INestApplication {
  app.setGlobalPrefix('api/v1');
  app.enableCors();
  app.useGlobalPipes(createValidationPipe());
  app.useGlobalFilters(new ProblemFilter());

  const doc = new DocumentBuilder()
    .setTitle('Seguimiento de mascotas — Grupo 1 (power-saving)')
    .setDescription(
      'Contrato común v1 (docs/01 Parte II) + variante `power-saving` (rutas marcadas con `x-variant`). ' +
        'Errores en RFC 9457 (`application/problem+json`).',
    )
    .setVersion('1')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, doc);
  SwaggerModule.setup('api/docs', app, document, {
    jsonDocumentUrl: 'api/docs-json',
  });
  return app;
}
