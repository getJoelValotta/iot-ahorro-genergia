import { NestFactory } from '@nestjs/core';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';

/**
 * Entrada para Vercel (función serverless). Reutiliza la app entre invocaciones de la
 * misma instancia; no hay procesos de fondo (docs/06 §2). Todavía no se desplegó.
 */
type Handler = (req: IncomingMessage, res: ServerResponse) => void;
let server: Promise<Handler> | undefined;

async function bootstrap(): Promise<Handler> {
  const app = configureApp(
    await NestFactory.create(AppModule, { logger: ['error', 'warn', 'log'] }),
  );
  await app.init();
  return app.getHttpAdapter().getInstance() as Handler;
}

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  server ??= bootstrap();
  (await server)(req, res);
}
