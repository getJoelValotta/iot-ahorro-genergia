import { Inject, Injectable } from '@nestjs/common';
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import {
  DeviceTakenError,
  EmailTakenError,
  isUuid,
  type NewPet,
  type PairingSessionRecord,
  type PetPatch,
  type PetRecord,
  type UserRecord,
} from './records';
import {
  PairingRepository,
  PetsRepository,
  UsersRepository,
} from './repositories';

export const SUPABASE = Symbol('SUPABASE');

/** Error de base sin detalles: el filtro global lo convierte en un 500 genérico. */
class DatabaseError extends Error {
  constructor(op: string, err: PostgrestError) {
    // El código de Postgres alcanza para diagnosticar; el mensaje puede traer datos.
    super(`database error in ${op} (code ${err.code})`);
    this.name = 'DatabaseError';
  }
}

const isUnique = (err: PostgrestError | null, constraint: string) =>
  err?.code === '23505' && (err.message ?? '').includes(constraint);

type UserRow = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  password_hash: string;
  created_at: string;
  updated_at: string;
};

const toUser = (r: UserRow): UserRecord => ({
  id: r.id,
  email: r.email,
  name: r.name,
  phone: r.phone,
  passwordHash: r.password_hash,
  createdAt: new Date(r.created_at),
  updatedAt: new Date(r.updated_at),
});

@Injectable()
export class SupabaseUsersRepository extends UsersRepository {
  constructor(@Inject(SUPABASE) private readonly db: SupabaseClient) {
    super();
  }

  async create(input: {
    email: string;
    name: string;
    phone: string | null;
    passwordHash: string;
  }): Promise<UserRecord> {
    const { data, error } = await this.db
      .from('users')
      .insert({
        email: input.email,
        name: input.name,
        phone: input.phone,
        password_hash: input.passwordHash,
      })
      .select()
      .single<UserRow>();
    if (isUnique(error, 'users_email_key')) throw new EmailTakenError();
    if (error) throw new DatabaseError('users.create', error);
    return toUser(data);
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    const { data, error } = await this.db
      .from('users')
      .select()
      .eq('email', email)
      .maybeSingle<UserRow>();
    if (error) throw new DatabaseError('users.findByEmail', error);
    return data ? toUser(data) : null;
  }

  async findById(id: string): Promise<UserRecord | null> {
    if (!isUuid(id)) return null;
    const { data, error } = await this.db
      .from('users')
      .select()
      .eq('id', id)
      .maybeSingle<UserRow>();
    if (error) throw new DatabaseError('users.findById', error);
    return data ? toUser(data) : null;
  }
}

type PetRow = {
  id: string;
  owner_id: string;
  name: string;
  species: PetRecord['species'];
  breed: string | null;
  birth_date: string | null;
  photo_url: string | null;
  device_id: string | null;
  power_mode: PetRecord['powerMode'];
  power_command_id: string | null;
  power_command_status: PetRecord['powerCommandStatus'];
  power_requested_at: string | null;
  created_at: string;
  updated_at: string;
};

const toPet = (r: PetRow): PetRecord => ({
  id: r.id,
  ownerId: r.owner_id,
  name: r.name,
  species: r.species,
  breed: r.breed,
  birthDate: r.birth_date,
  photoUrl: r.photo_url,
  deviceId: r.device_id,
  powerMode: r.power_mode,
  powerCommandId: r.power_command_id,
  powerCommandStatus: r.power_command_status,
  powerRequestedAt: r.power_requested_at
    ? new Date(r.power_requested_at)
    : null,
  createdAt: new Date(r.created_at),
  updatedAt: new Date(r.updated_at),
});

const PATCH_COLUMNS: Record<keyof PetPatch, keyof PetRow> = {
  name: 'name',
  species: 'species',
  breed: 'breed',
  birthDate: 'birth_date',
  photoUrl: 'photo_url',
  deviceId: 'device_id',
  powerMode: 'power_mode',
  powerCommandId: 'power_command_id',
  powerCommandStatus: 'power_command_status',
  powerRequestedAt: 'power_requested_at',
};

@Injectable()
export class SupabasePetsRepository extends PetsRepository {
  constructor(@Inject(SUPABASE) private readonly db: SupabaseClient) {
    super();
  }

  async listByOwner(
    ownerId: string,
    page: { offset: number; limit: number },
  ): Promise<{ items: PetRecord[]; total: number }> {
    const { data, error, count } = await this.db
      .from('pets')
      .select('*', { count: 'exact' })
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(page.offset, page.offset + page.limit - 1);
    // PostgREST responde 416 si el offset pasa el total: es una página vacía.
    if (error && error.code === 'PGRST103') {
      return { items: [], total: await this.countByOwner(ownerId) };
    }
    if (error) throw new DatabaseError('pets.listByOwner', error);
    return { items: (data as PetRow[]).map(toPet), total: count ?? 0 };
  }

  private async countByOwner(ownerId: string): Promise<number> {
    const { count, error } = await this.db
      .from('pets')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', ownerId);
    if (error) throw new DatabaseError('pets.count', error);
    return count ?? 0;
  }

  async create(ownerId: string, input: NewPet): Promise<PetRecord> {
    const { data, error } = await this.db
      .from('pets')
      .insert({
        owner_id: ownerId,
        name: input.name,
        species: input.species,
        breed: input.breed ?? null,
        birth_date: input.birthDate ?? null,
        photo_url: input.photoUrl ?? null,
      })
      .select()
      .single<PetRow>();
    if (error) throw new DatabaseError('pets.create', error);
    return toPet(data);
  }

  async findOwned(ownerId: string, petId: string): Promise<PetRecord | null> {
    if (!isUuid(petId)) return null;
    const { data, error } = await this.db
      .from('pets')
      .select()
      .eq('id', petId)
      .eq('owner_id', ownerId)
      .maybeSingle<PetRow>();
    if (error) throw new DatabaseError('pets.findOwned', error);
    return data ? toPet(data) : null;
  }

  async update(
    ownerId: string,
    petId: string,
    patch: PetPatch,
  ): Promise<PetRecord | null> {
    if (!isUuid(petId)) return null;
    const row: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) continue;
      const column = PATCH_COLUMNS[key as keyof PetPatch];
      row[column] = value instanceof Date ? value.toISOString() : value;
    }
    const { data, error } = await this.db
      .from('pets')
      .update(row)
      .eq('id', petId)
      .eq('owner_id', ownerId)
      .select()
      .maybeSingle<PetRow>();
    if (isUnique(error, 'pets_device_id_key')) throw new DeviceTakenError();
    if (error) throw new DatabaseError('pets.update', error);
    return data ? toPet(data) : null;
  }

  async delete(ownerId: string, petId: string): Promise<boolean> {
    if (!isUuid(petId)) return false;
    const { data, error } = await this.db
      .from('pets')
      .delete()
      .eq('id', petId)
      .eq('owner_id', ownerId)
      .select('id');
    if (error) throw new DatabaseError('pets.delete', error);
    return (data ?? []).length > 0;
  }

  async findByDeviceIds(deviceIds: string[]): Promise<PetRecord[]> {
    if (deviceIds.length === 0) return [];
    const { data, error } = await this.db
      .from('pets')
      .select()
      .in('device_id', deviceIds);
    if (error) throw new DatabaseError('pets.findByDeviceIds', error);
    return (data as PetRow[]).map(toPet);
  }

  async listWithDevice(ownerId: string): Promise<PetRecord[]> {
    const { data, error } = await this.db
      .from('pets')
      .select()
      .eq('owner_id', ownerId)
      .not('device_id', 'is', null)
      .order('created_at', { ascending: true });
    if (error) throw new DatabaseError('pets.listWithDevice', error);
    return (data as PetRow[]).map(toPet);
  }
}

type PairingRow = {
  id: string;
  user_id: string;
  code: string;
  expires_at: string;
  created_at: string;
};

const toPairing = (r: PairingRow): PairingSessionRecord => ({
  id: r.id,
  userId: r.user_id,
  code: r.code,
  expiresAt: new Date(r.expires_at),
  createdAt: new Date(r.created_at),
});

@Injectable()
export class SupabasePairingRepository extends PairingRepository {
  constructor(@Inject(SUPABASE) private readonly db: SupabaseClient) {
    super();
  }

  async create(input: {
    userId: string;
    code: string;
    expiresAt: Date;
    createdAt: Date;
  }): Promise<PairingSessionRecord> {
    const { data, error } = await this.db
      .from('pairing_sessions')
      .insert({
        user_id: input.userId,
        code: input.code,
        expires_at: input.expiresAt.toISOString(),
        created_at: input.createdAt.toISOString(),
      })
      .select()
      .single<PairingRow>();
    if (error) throw new DatabaseError('pairing.create', error);
    return toPairing(data);
  }

  async listByUser(userId: string): Promise<PairingSessionRecord[]> {
    const { data, error } = await this.db
      .from('pairing_sessions')
      .select()
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw new DatabaseError('pairing.listByUser', error);
    return (data as PairingRow[]).map(toPairing);
  }
}
