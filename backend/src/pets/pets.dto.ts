import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import type { PetRecord, Species } from '../database/records';

export const SPECIES: Species[] = ['dog', 'cat', 'other'];

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const lower = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;
/** Cadena vacía = sin dato (null), así el front puede "borrar" un campo opcional. */
const emptyToNull = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value.trim() === '' ? null : trim({ value });
/** Acepta `YYYY-MM-DD` o ISO 8601 completo y guarda solo la fecha (UTC). */
const toDateOnly = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const v = value.trim();
  if (v === '') return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const t = Date.parse(v);
  return Number.isNaN(t) ? v : new Date(t).toISOString().slice(0, 10);
};

const URL_OPTS = {
  require_protocol: true,
  protocols: ['http', 'https'],
  require_tld: false,
};
const DATE_MSG = { message: 'debe ser una fecha ISO 8601 o YYYY-MM-DD' };
const SPECIES_MSG = { message: 'debe ser dog, cat u other' };

export class CreatePetDto {
  @ApiProperty({ example: 'Firulais' })
  @Transform(trim)
  @IsString({ message: 'debe ser texto' })
  @IsNotEmpty({ message: 'es obligatorio' })
  @MaxLength(80)
  name!: string;

  @ApiProperty({ enum: SPECIES })
  @Transform(lower)
  @IsIn(SPECIES, SPECIES_MSG)
  species!: Species;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Transform(emptyToNull)
  @IsOptional()
  @IsString({ message: 'debe ser texto' })
  @MaxLength(80)
  breed?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: '2020-05-10' })
  @Transform(toDateOnly)
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, DATE_MSG)
  birthDate?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Transform(emptyToNull)
  @IsOptional()
  @IsUrl(URL_OPTS, { message: 'debe ser una URL http(s)' })
  @MaxLength(2048)
  photoUrl?: string | null;
}

/** PATCH parcial: lo ausente no se toca; `null` borra los opcionales. */
export class UpdatePetDto {
  @ApiPropertyOptional()
  @Transform(trim)
  @ValidateIf((_o, v) => v !== undefined)
  @IsString({ message: 'debe ser texto' })
  @IsNotEmpty({ message: 'no puede estar vacío' })
  @MaxLength(80)
  name?: string;

  @ApiPropertyOptional({ enum: SPECIES })
  @Transform(lower)
  @ValidateIf((_o, v) => v !== undefined)
  @IsIn(SPECIES, SPECIES_MSG)
  species?: Species;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Transform(emptyToNull)
  @IsOptional()
  @IsString({ message: 'debe ser texto' })
  @MaxLength(80)
  breed?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Transform(toDateOnly)
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, DATE_MSG)
  birthDate?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Transform(emptyToNull)
  @IsOptional()
  @IsUrl(URL_OPTS, { message: 'debe ser una URL http(s)' })
  @MaxLength(2048)
  photoUrl?: string | null;
}

export class PaginationQuery {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'debe ser un entero' })
  @Min(1, { message: 'debe ser al menos 1' })
  page: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'debe ser un entero' })
  @Min(1, { message: 'debe ser al menos 1' })
  @Max(100, { message: 'debe ser como máximo 100' })
  limit: number = 20;
}

export class PageMetaDto {
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
  @ApiProperty() total!: number;
}

export class PetDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: SPECIES }) species!: Species;
  @ApiProperty({ type: String, nullable: true }) breed!: string | null;
  @ApiProperty({ type: String, nullable: true }) birthDate!: string | null;
  @ApiProperty({ type: String, nullable: true }) photoUrl!: string | null;
  @ApiProperty({ type: String, nullable: true }) deviceId!: string | null;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
}

export class PetListDto {
  @ApiProperty({ type: [PetDto] }) data!: PetDto[];
  @ApiProperty() meta!: PageMetaDto;
}

export function toPetDto(p: PetRecord): PetDto {
  return {
    id: p.id,
    name: p.name,
    species: p.species,
    breed: p.breed,
    birthDate: p.birthDate,
    photoUrl: p.photoUrl,
    deviceId: p.deviceId,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}
