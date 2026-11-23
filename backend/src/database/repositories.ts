import type {
  NewPet,
  PairingSessionRecord,
  PetPatch,
  PetRecord,
  UserRecord,
} from './records';

/**
 * Interfaces de acceso a datos, una por agregado. Los servicios dependen de estas clases
 * abstractas (que también sirven de token de inyección); en producción las implementa
 * Supabase y en los tests una versión en memoria.
 */

export abstract class UsersRepository {
  /** @throws EmailTakenError si el email ya existe. */
  abstract create(input: {
    email: string;
    name: string;
    phone: string | null;
    passwordHash: string;
  }): Promise<UserRecord>;
  abstract findByEmail(email: string): Promise<UserRecord | null>;
  abstract findById(id: string): Promise<UserRecord | null>;
}

export abstract class PetsRepository {
  abstract listByOwner(
    ownerId: string,
    page: { offset: number; limit: number },
  ): Promise<{ items: PetRecord[]; total: number }>;
  abstract create(ownerId: string, input: NewPet): Promise<PetRecord>;
  /** Devuelve null si no existe o es de otro dueño. */
  abstract findOwned(ownerId: string, petId: string): Promise<PetRecord | null>;
  /**
   * Actualiza solo si la mascota es del dueño; null si no.
   * @throws DeviceTakenError si `deviceId` ya está en otra mascota.
   */
  abstract update(
    ownerId: string,
    petId: string,
    patch: PetPatch,
  ): Promise<PetRecord | null>;
  abstract delete(ownerId: string, petId: string): Promise<boolean>;
  /** Mascotas (de cualquier dueño) que tienen alguno de estos dispositivos. */
  abstract findByDeviceIds(deviceIds: string[]): Promise<PetRecord[]>;
  /** Mascotas del dueño con collar vinculado. */
  abstract listWithDevice(ownerId: string): Promise<PetRecord[]>;
}

export abstract class PairingRepository {
  abstract create(input: {
    userId: string;
    code: string;
    expiresAt: Date;
    createdAt: Date;
  }): Promise<PairingSessionRecord>;
  abstract listByUser(userId: string): Promise<PairingSessionRecord[]>;
}
