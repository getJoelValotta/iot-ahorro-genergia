import { randomUUID } from 'node:crypto';
import {
  DeviceTakenError,
  EmailTakenError,
  type NewPet,
  type PairingSessionRecord,
  type PetPatch,
  type PetRecord,
  type UserRecord,
} from '../database/records';
import {
  PairingRepository,
  PetsRepository,
  UsersRepository,
} from '../database/repositories';

/**
 * Repositorios en memoria con la misma semántica que los de Supabase (unicidad de email y de
 * `device_id`, aislamiento por dueño). Se usan en los tests unitarios y por HTTP.
 */

export class InMemoryUsersRepository extends UsersRepository {
  readonly rows = new Map<string, UserRecord>();

  create(input: {
    email: string;
    name: string;
    phone: string | null;
    passwordHash: string;
  }): Promise<UserRecord> {
    for (const u of this.rows.values()) {
      if (u.email === input.email) return Promise.reject(new EmailTakenError());
    }
    const now = new Date();
    const user: UserRecord = {
      id: randomUUID(),
      ...input,
      createdAt: now,
      updatedAt: now,
    };
    this.rows.set(user.id, user);
    return Promise.resolve({ ...user });
  }

  findByEmail(email: string): Promise<UserRecord | null> {
    const u = [...this.rows.values()].find((r) => r.email === email);
    return Promise.resolve(u ? { ...u } : null);
  }

  findById(id: string): Promise<UserRecord | null> {
    const u = this.rows.get(id);
    return Promise.resolve(u ? { ...u } : null);
  }
}

export class InMemoryPetsRepository extends PetsRepository {
  readonly rows = new Map<string, PetRecord>();
  private seq = 0;

  listByOwner(
    ownerId: string,
    page: { offset: number; limit: number },
  ): Promise<{ items: PetRecord[]; total: number }> {
    const all = [...this.rows.values()].filter((p) => p.ownerId === ownerId);
    return Promise.resolve({
      items: all
        .slice(page.offset, page.offset + page.limit)
        .map((p) => ({ ...p })),
      total: all.length,
    });
  }

  create(ownerId: string, input: NewPet): Promise<PetRecord> {
    // Fechas estrictamente crecientes para que el orden sea estable como en la base.
    const now = new Date(Date.now() + this.seq++);
    const pet: PetRecord = {
      id: randomUUID(),
      ownerId,
      name: input.name,
      species: input.species,
      breed: input.breed ?? null,
      birthDate: input.birthDate ?? null,
      photoUrl: input.photoUrl ?? null,
      deviceId: null,
      powerMode: 'normal',
      powerCommandId: null,
      powerCommandStatus: 'none',
      powerRequestedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.rows.set(pet.id, pet);
    return Promise.resolve({ ...pet });
  }

  findOwned(ownerId: string, petId: string): Promise<PetRecord | null> {
    const p = this.rows.get(petId);
    return Promise.resolve(p && p.ownerId === ownerId ? { ...p } : null);
  }

  update(
    ownerId: string,
    petId: string,
    patch: PetPatch,
  ): Promise<PetRecord | null> {
    const p = this.rows.get(petId);
    if (!p || p.ownerId !== ownerId) return Promise.resolve(null);
    if (patch.deviceId) {
      const taken = [...this.rows.values()].some(
        (o) => o.id !== petId && o.deviceId === patch.deviceId,
      );
      if (taken) return Promise.reject(new DeviceTakenError());
    }
    const clean = Object.fromEntries(
      Object.entries(patch).filter(([, v]) => v !== undefined),
    );
    const next: PetRecord = { ...p, ...clean, updatedAt: new Date() };
    this.rows.set(petId, next);
    return Promise.resolve({ ...next });
  }

  delete(ownerId: string, petId: string): Promise<boolean> {
    const p = this.rows.get(petId);
    if (!p || p.ownerId !== ownerId) return Promise.resolve(false);
    this.rows.delete(petId);
    return Promise.resolve(true);
  }

  findByDeviceIds(deviceIds: string[]): Promise<PetRecord[]> {
    return Promise.resolve(
      [...this.rows.values()]
        .filter((p) => p.deviceId !== null && deviceIds.includes(p.deviceId))
        .map((p) => ({ ...p })),
    );
  }

  listWithDevice(ownerId: string): Promise<PetRecord[]> {
    return Promise.resolve(
      [...this.rows.values()]
        .filter((p) => p.ownerId === ownerId && p.deviceId !== null)
        .map((p) => ({ ...p })),
    );
  }
}

export class InMemoryPairingRepository extends PairingRepository {
  readonly rows: PairingSessionRecord[] = [];

  create(input: {
    userId: string;
    code: string;
    expiresAt: Date;
    createdAt: Date;
  }): Promise<PairingSessionRecord> {
    const row = { id: randomUUID(), ...input };
    this.rows.push(row);
    return Promise.resolve({ ...row });
  }

  listByUser(userId: string): Promise<PairingSessionRecord[]> {
    return Promise.resolve(
      this.rows.filter((r) => r.userId === userId).map((r) => ({ ...r })),
    );
  }
}
