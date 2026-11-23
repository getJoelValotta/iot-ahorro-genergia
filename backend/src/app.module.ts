import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { CapabilitiesModule } from './capabilities/capabilities';
import { APP_CONFIG, loadConfig } from './config/app-config';
import { DatabaseModule } from './database/database.module';
import { DevicesModule } from './devices/devices.module';
import { EmbedModule } from './embed/embed';
import { OvenbirdModule } from './ovenbird/ovenbird.module';
import { PetsModule } from './pets/pets.module';
import { PowerModule } from './power/power';

/** Config validada al arrancar: si falta algo, la app no levanta (mensaje sin valores). */
@Global()
@Module({
  imports: [
    // Solo carga `backend/.env` en process.env (en tests no se lee el archivo).
    ConfigModule.forRoot({ ignoreEnvFile: process.env.NODE_ENV === 'test' }),
  ],
  providers: [
    { provide: APP_CONFIG, useFactory: () => loadConfig(process.env) },
  ],
  exports: [APP_CONFIG],
})
export class AppConfigModule {}

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    OvenbirdModule,
    AuthModule,
    PetsModule,
    DevicesModule,
    EmbedModule,
    PowerModule,
    CapabilitiesModule,
  ],
})
export class AppModule {}
