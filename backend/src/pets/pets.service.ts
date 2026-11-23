import { Injectable } from '@nestjs/common';
import { Problems } from '../common/problem';
import type { PetRecord } from '../database/records';
import { PetsRepository } from '../database/repositories';
import {
  type CreatePetDto,
  type PaginationQuery,
  type PetDto,
  type PetListDto,
  toPetDto,
  type UpdatePetDto,
} from './pets.dto';

/**
 * CRUD de mascotas con aislamiento estricto: una mascota de otro usuario se comporta
 * exactamente igual que una inexistente (`404 PET_NOT_FOUND`).
 */
@Injectable()
export class PetsService {
  constructor(private readonly pets: PetsRepository) {}

  async list(ownerId: string, q: PaginationQuery): Promise<PetListDto> {
    const { items, total } = await this.pets.listByOwner(ownerId, {
      offset: (q.page - 1) * q.limit,
      limit: q.limit,
    });
    return {
      data: items.map(toPetDto),
      meta: { page: q.page, limit: q.limit, total },
    };
  }

  async create(ownerId: string, dto: CreatePetDto): Promise<PetDto> {
    const pet = await this.pets.create(ownerId, {
      name: dto.name,
      species: dto.species,
      breed: dto.breed ?? null,
      birthDate: dto.birthDate ?? null,
      photoUrl: dto.photoUrl ?? null,
    });
    return toPetDto(pet);
  }

  async get(ownerId: string, petId: string): Promise<PetDto> {
    return toPetDto(await this.getOwned(ownerId, petId));
  }

  /** Para otros servicios: la mascota del usuario o `404 PET_NOT_FOUND`. */
  async getOwned(ownerId: string, petId: string): Promise<PetRecord> {
    const pet = await this.pets.findOwned(ownerId, petId);
    if (!pet) throw Problems.petNotFound();
    return pet;
  }

  async update(
    ownerId: string,
    petId: string,
    dto: UpdatePetDto,
  ): Promise<PetDto> {
    const pet = await this.pets.update(ownerId, petId, {
      name: dto.name,
      species: dto.species,
      breed: dto.breed,
      birthDate: dto.birthDate,
      photoUrl: dto.photoUrl,
    });
    if (!pet) throw Problems.petNotFound();
    return toPetDto(pet);
  }

  async remove(ownerId: string, petId: string): Promise<void> {
    const pet = await this.getOwned(ownerId, petId);
    // Contrato (docs/01 §7 regla 2): liberar el collar antes de borrar.
    if (pet.deviceId)
      await this.pets.update(ownerId, petId, { deviceId: null });
    const deleted = await this.pets.delete(ownerId, petId);
    if (!deleted) throw Problems.petNotFound();
  }
}
