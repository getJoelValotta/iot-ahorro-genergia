import { Global, Module } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import { APP_CONFIG, type AppConfig } from '../config/app-config';
import {
  PairingRepository,
  PetsRepository,
  UsersRepository,
} from './repositories';
import {
  SUPABASE,
  SupabasePairingRepository,
  SupabasePetsRepository,
  SupabaseUsersRepository,
} from './supabase.repositories';

/**
 * Cliente de Supabase con la clave de servicio (solo en el back; RLS activado sin políticas)
 * y los repositorios por agregado.
 */
@Global()
@Module({
  providers: [
    {
      provide: SUPABASE,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) =>
        createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        }),
    },
    { provide: UsersRepository, useClass: SupabaseUsersRepository },
    { provide: PetsRepository, useClass: SupabasePetsRepository },
    { provide: PairingRepository, useClass: SupabasePairingRepository },
  ],
  exports: [UsersRepository, PetsRepository, PairingRepository],
})
export class DatabaseModule {}
