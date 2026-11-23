import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Injectable,
  Module,
  Param,
  Put,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiExtension,
  ApiProperty,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Command } from '@ovenbird/node';
import { Transform } from 'class-transformer';
import { IsIn } from 'class-validator';
import { type AuthUser, CurrentUser } from '../common/auth-user';
import { Problems } from '../common/problem';
import { APP_CONFIG, type AppConfig } from '../config/app-config';
import type { CommandStatus, PetRecord, PowerMode } from '../database/records';
import { PetsRepository } from '../database/repositories';
import { OvenbirdGateway } from '../ovenbird/ovenbird.gateway';
import { PetsModule } from '../pets/pets.module';
import { PetsService } from '../pets/pets.service';
import { estimatePower } from './power-model';

const MODES: PowerMode[] = ['normal', 'saving'];

export class SetPowerModeDto {
  @ApiProperty({ enum: MODES })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsIn(MODES, { message: 'debe ser normal o saving' })
  mode!: PowerMode;
}

class PowerCommandDto {
  @ApiProperty({ enum: ['none', 'pending', 'confirmed', 'failed'] })
  status!: CommandStatus;
  @ApiProperty({ type: String, nullable: true }) commandId!: string | null;
  @ApiProperty({ type: String, nullable: true }) requestedAt!: string | null;
}

class ModeEstimateDto {
  @ApiProperty() avgCurrentMa!: number;
  @ApiProperty() hoursFull!: number;
  @ApiProperty({ type: Number, nullable: true }) hoursRemaining!: number | null;
}

class PowerEstimatesDto {
  @ApiProperty() normal!: ModeEstimateDto;
  @ApiProperty() saving!: ModeEstimateDto;
}

export class PowerStateDto {
  @ApiProperty({ enum: MODES, description: 'Modo pedido por el usuario' })
  mode!: PowerMode;
  @ApiProperty() reportIntervalS!: number;
  @ApiProperty() command!: PowerCommandDto;
  @ApiProperty({ type: Number, nullable: true }) batteryPct!: number | null;
  @ApiProperty({ description: 'Capacidad supuesta (BATTERY_CAPACITY_MAH)' })
  batteryCapacityMah!: number;
  @ApiProperty() estimates!: PowerEstimatesDto;
}

/** Traduce el estado de un comando de Ovenbird al de nuestra UI. */
export function commandOutcome(cmd: Command): CommandStatus {
  if (cmd.status === 'acked')
    return cmd.result?.result === 'error' ? 'failed' : 'confirmed';
  if (cmd.status === 'failed' || cmd.status === 'expired') return 'failed';
  return 'pending';
}

/**
 * Variante `power-saving`: cambia el intervalo de reporte del collar con `report_interval_s`
 * y estima la autonomía. El backend es serverless: el estado del comando se reconcilia
 * a demanda en cada GET (docs/06 §2).
 */
@Injectable()
export class PowerService {
  constructor(
    private readonly pets: PetsService,
    private readonly petsRepo: PetsRepository,
    private readonly ovenbird: OvenbirdGateway,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async get(userId: string, petId: string): Promise<PowerStateDto> {
    let pet = await this.withDevice(userId, petId);
    if (pet.powerCommandStatus === 'pending' && pet.powerCommandId) {
      const cmd = await this.ovenbird.getCommand(pet.powerCommandId);
      const status = commandOutcome(cmd);
      if (status !== 'pending') {
        pet =
          (await this.petsRepo.update(userId, petId, {
            powerCommandStatus: status,
          })) ?? pet;
      }
    }
    return this.state(pet);
  }

  async set(
    userId: string,
    petId: string,
    mode: PowerMode,
  ): Promise<PowerStateDto> {
    const pet = await this.withDevice(userId, petId);
    // Si Ovenbird falla, la excepción sale acá y el modo guardado no cambia.
    const cmd = await this.ovenbird.sendCommand(
      pet.deviceId as string,
      { report_interval_s: this.intervalFor(mode) },
      this.commandTtlS(),
    );
    const updated = await this.petsRepo.update(userId, petId, {
      powerMode: mode,
      powerCommandId: cmd.commandId,
      powerCommandStatus: commandOutcome(cmd),
      powerRequestedAt: new Date(),
    });
    if (!updated) throw Problems.petNotFound();
    return this.state(updated);
  }

  private async withDevice(userId: string, petId: string): Promise<PetRecord> {
    const pet = await this.pets.getOwned(userId, petId);
    if (!pet.deviceId) throw Problems.petHasNoDevice();
    return pet;
  }

  private intervalFor(mode: PowerMode): number {
    return mode === 'saving'
      ? this.config.powerSavingIntervalS
      : this.config.powerNormalIntervalS;
  }

  /**
   * En ahorro el collar solo escucha 500 ms después de cada TX y la unidad reintenta en 3
   * ventanas: el comando tiene que sobrevivir al menos 4 intervalos de ahorro.
   */
  private commandTtlS(): number {
    return Math.min(3600, Math.max(120, this.config.powerSavingIntervalS * 4));
  }

  private async state(pet: PetRecord): Promise<PowerStateDto> {
    const status = await this.ovenbird.deviceStatus(pet.deviceId as string);
    const raw = status.dps.battery_pct?.value;
    const batteryPct =
      typeof raw === 'number' && Number.isFinite(raw) ? raw : null;
    return {
      mode: pet.powerMode,
      reportIntervalS: this.intervalFor(pet.powerMode),
      command: {
        status: pet.powerCommandStatus,
        commandId: pet.powerCommandId,
        requestedAt: pet.powerRequestedAt?.toISOString() ?? null,
      },
      batteryPct,
      batteryCapacityMah: this.config.batteryCapacityMah,
      estimates: estimatePower({
        capacityMah: this.config.batteryCapacityMah,
        batteryPct,
        normalIntervalS: this.config.powerNormalIntervalS,
        savingIntervalS: this.config.powerSavingIntervalS,
      }),
    };
  }
}

@ApiTags('Variante: ahorro de energía')
@ApiBearerAuth()
@Controller('pets/:petId/power')
export class PowerController {
  constructor(private readonly power: PowerService) {}

  @Get()
  @ApiExtension('x-variant', 'power-saving')
  @ApiResponse({ status: 200, type: PowerStateDto })
  @ApiResponse({ status: 404, description: 'PET_NOT_FOUND' })
  @ApiResponse({ status: 409, description: 'PET_HAS_NO_DEVICE' })
  get(
    @CurrentUser() user: AuthUser,
    @Param('petId') petId: string,
  ): Promise<PowerStateDto> {
    return this.power.get(user.id, petId);
  }

  @Put()
  @HttpCode(202)
  @ApiExtension('x-variant', 'power-saving')
  @ApiResponse({ status: 202, type: PowerStateDto })
  @ApiResponse({ status: 404, description: 'PET_NOT_FOUND' })
  @ApiResponse({ status: 409, description: 'PET_HAS_NO_DEVICE' })
  set(
    @CurrentUser() user: AuthUser,
    @Param('petId') petId: string,
    @Body() dto: SetPowerModeDto,
  ): Promise<PowerStateDto> {
    return this.power.set(user.id, petId, dto.mode);
  }
}

@Module({
  imports: [PetsModule],
  controllers: [PowerController],
  providers: [PowerService],
})
export class PowerModule {}
