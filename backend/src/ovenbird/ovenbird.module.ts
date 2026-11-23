import { Global, Module } from '@nestjs/common';
import { OvenbirdClient } from '@ovenbird/node';
import { APP_CONFIG, type AppConfig } from '../config/app-config';
import { OVENBIRD_CLIENT, OvenbirdGateway } from './ovenbird.gateway';

/**
 * Cliente de `@ovenbird/node` configurado por variables de entorno. No usamos
 * `@ovenbird/node/nest` porque declara peer `@nestjs/common@^10` y el back usa Nest 11
 * (la consigna pide Jest); el cliente es el mismo.
 */
@Global()
@Module({
  providers: [
    {
      provide: OVENBIRD_CLIENT,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) =>
        new OvenbirdClient({
          baseUrl: config.ovenbirdUrl,
          clientId: config.ovenbirdClientId,
          clientSecret: config.ovenbirdClientSecret,
          timeoutMs: 8000,
          retries: 2,
        }),
    },
    OvenbirdGateway,
  ],
  exports: [OvenbirdGateway],
})
export class OvenbirdModule {}
