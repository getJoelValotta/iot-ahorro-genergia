import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiResponse, ApiTags } from '@nestjs/swagger';
import { type AuthUser, CurrentUser } from '../common/auth-user';
import { PaginationQuery, PetDto } from '../pets/pets.dto';
import {
  CreatePairingCodeDto,
  DeviceListDto,
  LinkDeviceDto,
  PairingCodeDto,
} from './devices.dto';
import { DevicesService } from './devices.service';

@ApiTags('Dispositivos')
@ApiBearerAuth()
@Controller()
export class DevicesController {
  constructor(private readonly devices: DevicesService) {}

  @Post('pairing-codes')
  @ApiBody({ type: CreatePairingCodeDto, required: false })
  @ApiResponse({ status: 201, type: PairingCodeDto })
  @ApiResponse({ status: 502, description: 'Ovenbird no disponible' })
  createPairingCode(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreatePairingCodeDto,
  ): Promise<PairingCodeDto> {
    return this.devices.createPairingCode(user.id, dto?.label);
  }

  @Get('devices')
  @ApiResponse({ status: 200, type: DeviceListDto })
  list(
    @CurrentUser() user: AuthUser,
    @Query() q: PaginationQuery,
  ): Promise<DeviceListDto> {
    return this.devices.list(user.id, q);
  }

  @Put('pets/:petId/device')
  @ApiResponse({ status: 200, type: PetDto })
  @ApiResponse({ status: 404, description: 'PET_NOT_FOUND / DEVICE_NOT_FOUND' })
  @ApiResponse({
    status: 409,
    description: 'DEVICE_ALREADY_LINKED / PET_ALREADY_HAS_DEVICE',
  })
  link(
    @CurrentUser() user: AuthUser,
    @Param('petId') petId: string,
    @Body() dto: LinkDeviceDto,
  ): Promise<PetDto> {
    return this.devices.link(user.id, petId, dto.deviceId);
  }

  @Delete('pets/:petId/device')
  @HttpCode(204)
  @ApiResponse({ status: 204 })
  @ApiResponse({ status: 404, description: 'PET_NOT_FOUND' })
  unlink(
    @CurrentUser() user: AuthUser,
    @Param('petId') petId: string,
  ): Promise<void> {
    return this.devices.unlink(user.id, petId);
  }
}
