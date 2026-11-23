import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';

async function bootstrap() {
  const app = configureApp(await NestFactory.create(AppModule));
  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
  Logger.log(
    `Backend en http://localhost:${port}/api/v1 (Swagger: /api/docs)`,
    'Bootstrap',
  );
}

bootstrap().catch((err: unknown) => {
  // ConfigError ya trae un mensaje claro y sin valores secretos.
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
