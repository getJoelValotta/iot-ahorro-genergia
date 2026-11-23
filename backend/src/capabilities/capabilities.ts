import { Controller, Get, Module } from '@nestjs/common';
import { ApiProperty, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/auth-user';

/** Variante del Grupo 1. Es la única que anunciamos (docs/01 Parte III). */
export const VARIANTS = ['power-saving'] as const;

export class CapabilitiesDto {
  @ApiProperty({ example: '1' }) apiVersion!: '1';
  @ApiProperty({ type: [String], example: VARIANTS }) variants!: string[];
}

@ApiTags('Variantes')
@Controller('capabilities')
export class CapabilitiesController {
  @Public()
  @Get()
  @ApiResponse({ status: 200, type: CapabilitiesDto })
  get(): CapabilitiesDto {
    return { apiVersion: '1', variants: [...VARIANTS] };
  }
}

@Module({ controllers: [CapabilitiesController] })
export class CapabilitiesModule {}
