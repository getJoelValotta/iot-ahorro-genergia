import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const lower = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class RegisterDto {
  @ApiProperty({ example: 'ana@example.com' })
  @Transform(lower)
  @IsEmail({}, { message: 'debe ser un email válido' })
  @MaxLength(254)
  email!: string;

  @ApiProperty({ minLength: 8, example: 'secreta123' })
  @IsString({ message: 'debe ser texto' })
  @MinLength(8, { message: 'debe tener al menos 8 caracteres' })
  // bcrypt solo usa los primeros 72 bytes.
  @MaxLength(72, { message: 'debe tener como máximo 72 caracteres' })
  password!: string;

  @ApiProperty({ example: 'Ana' })
  @Transform(trim)
  @IsString({ message: 'debe ser texto' })
  @IsNotEmpty({ message: 'es obligatorio' })
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ nullable: true, example: '+54 223 555-0000' })
  @Transform(trim)
  @IsOptional()
  @IsString({ message: 'debe ser texto' })
  @MaxLength(30)
  phone?: string | null;
}

export class LoginDto {
  @ApiProperty({ example: 'ana@example.com' })
  @Transform(lower)
  @IsString({ message: 'debe ser texto' })
  @IsNotEmpty({ message: 'es obligatorio' })
  email!: string;

  @ApiProperty({ example: 'secreta123' })
  @IsString({ message: 'debe ser texto' })
  @IsNotEmpty({ message: 'es obligatorio' })
  password!: string;
}

export class AuthTokenDto {
  @ApiProperty() accessToken!: string;
  @ApiProperty({ enum: ['Bearer'] }) tokenType!: 'Bearer';
  @ApiProperty({ description: 'Segundos hasta que vence' }) expiresIn!: number;
}

export class UserDto {
  @ApiProperty() id!: string;
  @ApiProperty() email!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ type: String, nullable: true }) phone!: string | null;
}
