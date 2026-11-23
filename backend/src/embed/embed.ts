import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Injectable,
  Module,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiProperty,
  ApiPropertyOptional,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { type AuthUser, CurrentUser } from '../common/auth-user';
import { ProblemException } from '../common/problem';
import { APP_CONFIG, type AppConfig } from '../config/app-config';
import { PetsRepository } from '../database/repositories';
import { OvenbirdGateway } from '../ovenbird/ovenbird.gateway';
import { PetsModule } from '../pets/pets.module';
import { PetsService } from '../pets/pets.service';

/** Límites de Ovenbird para `embed.createToken`. */
const MAX_DEVICES = 50;
const MIN_TTL_S = 60;
const MAX_TTL_S = 3600;

export class EmbedTokenRequestDto {
  @ApiPropertyOptional({ type: [String], maxItems: MAX_DEVICES })
  @IsOptional()
  @IsArray({ message: 'debe ser una lista' })
  @ArrayMaxSize(MAX_DEVICES, {
    message: `como máximo ${MAX_DEVICES} dispositivos`,
  })
  @IsString({ each: true, message: 'cada elemento debe ser texto' })
  @IsNotEmpty({ each: true, message: 'no puede haber ids vacíos' })
  deviceIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString({ message: 'debe ser texto' })
  @IsNotEmpty({ message: 'no puede estar vacío' })
  petId?: string;

  @ApiPropertyOptional({
    default: 900,
    minimum: MIN_TTL_S,
    maximum: MAX_TTL_S,
    description:
      'Se ajusta al rango 60..3600 (no da error: contrato tolerante)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'debe ser un entero' })
  ttlS?: number;
}

export class EmbedTokenDto {
  @ApiProperty() token!: string;
  @ApiProperty({ description: 'ISO 8601 UTC' }) expiresAt!: string;
}

const noLinkedDevices = () =>
  new ProblemException(
    HttpStatus.CONFLICT,
    'NO_LINKED_DEVICES',
    'Sin collares vinculados',
    'No tenés collares vinculados. Emparejá uno y vinculalo a una mascota.',
  );

/**
 * Token de solo lectura para que el front muestre el mapa con `@ovenbird/react`.
 * Solo incluye dispositivos vinculados a mascotas del usuario; nunca devuelve el `clientSecret`.
 */
@Injectable()
export class EmbedService {
  constructor(
    private readonly ovenbird: OvenbirdGateway,
    private readonly petsRepo: PetsRepository,
    private readonly pets: PetsService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async createToken(
    userId: string,
    dto: EmbedTokenRequestDto,
  ): Promise<EmbedTokenDto> {
    const own = (await this.petsRepo.listWithDevice(userId)).map(
      (p) => p.deviceId as string,
    );
    let ids: string[];

    if (dto.petId || dto.deviceIds?.length) {
      const wanted = new Set<string>(dto.deviceIds ?? []);
      if (dto.petId) {
        const pet = await this.pets.getOwned(userId, dto.petId);
        if (!pet.deviceId) throw noLinkedDevices();
        wanted.add(pet.deviceId);
      }
      // No distingue "no existe" de "es de otro": 403 en ambos casos.
      if ([...wanted].some((id) => !own.includes(id))) {
        throw new ProblemException(
          HttpStatus.FORBIDDEN,
          'DEVICE_NOT_ALLOWED',
          'Dispositivo no permitido',
          'Alguno de los dispositivos pedidos no está vinculado a tus mascotas.',
        );
      }
      ids = [...wanted];
    } else {
      ids = own;
    }

    if (ids.length === 0) throw noLinkedDevices();
    const ttlS = Math.min(
      Math.max(dto.ttlS ?? this.config.embedTokenTtlS, MIN_TTL_S),
      MAX_TTL_S,
    );
    const { token, expiresAt } = await this.ovenbird.createEmbedToken(
      ids.slice(0, MAX_DEVICES),
      ttlS,
    );
    return { token, expiresAt: expiresAt.toISOString() };
  }
}

@ApiTags('Mapa')
@ApiBearerAuth()
@Controller('embed-token')
export class EmbedController {
  constructor(private readonly embed: EmbedService) {}

  @Post()
  @HttpCode(200)
  @ApiResponse({ status: 200, type: EmbedTokenDto })
  @ApiResponse({ status: 403, description: 'DEVICE_NOT_ALLOWED' })
  @ApiResponse({ status: 409, description: 'NO_LINKED_DEVICES' })
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: EmbedTokenRequestDto,
  ): Promise<EmbedTokenDto> {
    return this.embed.createToken(user.id, dto ?? {});
  }
}

@Module({
  imports: [PetsModule],
  controllers: [EmbedController],
  providers: [EmbedService],
})
export class EmbedModule {}
