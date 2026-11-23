import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { PageMetaDto } from '../pets/pets.dto';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreatePairingCodeDto {
  @ApiPropertyOptional({
    description: 'Etiqueta para identificar el código en Ovenbird',
  })
  @Transform(trim)
  @IsOptional()
  @IsString({ message: 'debe ser texto' })
  @MaxLength(60)
  label?: string;
}

export class PairingCodeDto {
  @ApiProperty() code!: string;
  @ApiProperty({ description: 'ISO 8601 UTC' }) expiresAt!: string;
}

export class LinkDeviceDto {
  @ApiProperty()
  @Transform(trim)
  @IsString({ message: 'debe ser texto' })
  @IsNotEmpty({ message: 'es obligatorio' })
  @MaxLength(128)
  deviceId!: string;
}

export class DeviceDto {
  @ApiProperty() deviceId!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ example: 'ob.lora.unit' }) productId!: string;
  @ApiProperty() online!: boolean;
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'null solo si nunca se vio',
  })
  lastSeenAt!: string | null;
  @ApiProperty({ type: String, nullable: true }) petId!: string | null;
}

export class DeviceListDto {
  @ApiProperty({ type: [DeviceDto] }) data!: DeviceDto[];
  @ApiProperty() meta!: PageMetaDto;
}
