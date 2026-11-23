import { HttpStatus, Injectable } from '@nestjs/common';
import type { Device } from '@ovenbird/node';
import { ProblemException, Problems } from '../common/problem';
import { DeviceTakenError, type PetRecord } from '../database/records';
import { PairingRepository, PetsRepository } from '../database/repositories';
import { OvenbirdGateway } from '../ovenbird/ovenbird.gateway';
import { type PaginationQuery, type PetDto, toPetDto } from '../pets/pets.dto';
import { PetsService } from '../pets/pets.service';
import type { DeviceDto, DeviceListDto, PairingCodeDto } from './devices.dto';

/** Margen por diferencias de reloj entre nuestro servidor y Ovenbird. */
const CLOCK_SKEW_MS = 60_000;
const DEFAULT_LABEL = 'Collar mascota';

const deviceAlreadyLinked = () =>
  new ProblemException(
    HttpStatus.CONFLICT,
    'DEVICE_ALREADY_LINKED',
    'Collar ya vinculado',
    'Ese collar ya está vinculado a otra mascota. Desvinculalo primero.',
  );

const deviceNotFound = () =>
  new ProblemException(
    HttpStatus.NOT_FOUND,
    'DEVICE_NOT_FOUND',
    'Dispositivo no encontrado',
    'El dispositivo no existe o no está disponible para tu cuenta. Generá un código y emparejalo.',
  );

/**
 * Emparejamiento y vínculo de collares. Un usuario ve sus collares vinculados más los libres
 * que aparecieron en Ovenbird durante la vigencia de alguno de sus códigos (docs/01 §7 regla 3).
 */
@Injectable()
export class DevicesService {
  constructor(
    private readonly ovenbird: OvenbirdGateway,
    private readonly pairing: PairingRepository,
    private readonly petsRepo: PetsRepository,
    private readonly pets: PetsService,
  ) {}

  async createPairingCode(
    userId: string,
    label?: string,
  ): Promise<PairingCodeDto> {
    const createdAt = new Date();
    const { code, expiresAt } = await this.ovenbird.createPairingCode(
      label || DEFAULT_LABEL,
    );
    await this.pairing.create({ userId, code, expiresAt, createdAt });
    return { code, expiresAt: expiresAt.toISOString() };
  }

  async list(userId: string, q: PaginationQuery): Promise<DeviceListDto> {
    const visible = await this.visibleDevices(userId);
    const start = (q.page - 1) * q.limit;
    return {
      data: visible.slice(start, start + q.limit),
      meta: { page: q.page, limit: q.limit, total: visible.length },
    };
  }

  async link(userId: string, petId: string, deviceId: string): Promise<PetDto> {
    const pet = await this.pets.getOwned(userId, petId);
    if (pet.deviceId === deviceId) return toPetDto(pet); // idempotente
    if (pet.deviceId) {
      throw new ProblemException(
        HttpStatus.CONFLICT,
        'PET_ALREADY_HAS_DEVICE',
        'La mascota ya tiene collar',
        'Esta mascota ya tiene otro collar vinculado. Desvinculalo primero.',
      );
    }
    const [holder] = await this.petsRepo.findByDeviceIds([deviceId]);
    if (holder) throw deviceAlreadyLinked();

    const visible = await this.visibleDevices(userId);
    if (!visible.some((d) => d.deviceId === deviceId)) throw deviceNotFound();

    try {
      const updated = await this.petsRepo.update(userId, petId, {
        deviceId,
        // Collar nuevo: el estado del último comando de ahorro ya no aplica.
        powerMode: 'normal',
        powerCommandId: null,
        powerCommandStatus: 'none',
        powerRequestedAt: null,
      });
      if (!updated) throw Problems.petNotFound();
      return toPetDto(updated);
    } catch (err) {
      // Carrera: otro pedido lo vinculó entre la verificación y la escritura (unicidad en la base).
      if (err instanceof DeviceTakenError) throw deviceAlreadyLinked();
      throw err;
    }
  }

  async unlink(userId: string, petId: string): Promise<void> {
    const pet = await this.pets.getOwned(userId, petId);
    if (pet.deviceId)
      await this.petsRepo.update(userId, petId, { deviceId: null });
  }

  /** Collares del usuario + libres aparecidos en sus ventanas de emparejamiento. */
  private async visibleDevices(userId: string): Promise<DeviceDto[]> {
    const [devices, sessions] = await Promise.all([
      this.ovenbird.listAllDevices(),
      this.pairing.listByUser(userId),
    ]);
    const linked = await this.petsRepo.findByDeviceIds(
      devices.map((d) => d.deviceId),
    );
    const byDevice = new Map<string, PetRecord>(
      linked.map((p) => [p.deviceId as string, p]),
    );

    const inUserWindow = (d: Device) => {
      const t = d.createdAt.getTime();
      return sessions.some(
        (s) =>
          t >= s.createdAt.getTime() - CLOCK_SKEW_MS &&
          t <= s.expiresAt.getTime() + CLOCK_SKEW_MS,
      );
    };

    return devices
      .filter((d) => {
        const pet = byDevice.get(d.deviceId);
        return pet ? pet.ownerId === userId : inUserWindow(d);
      })
      .map((d) => ({
        deviceId: d.deviceId,
        name: d.name,
        productId: d.productId,
        online: d.online,
        lastSeenAt: d.lastSeenAt ? d.lastSeenAt.toISOString() : null,
        petId: byDevice.get(d.deviceId)?.id ?? null,
      }));
  }
}
