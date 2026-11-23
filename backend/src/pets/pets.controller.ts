import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiResponse, ApiTags } from '@nestjs/swagger';
import { type AuthUser, CurrentUser } from '../common/auth-user';
import {
  CreatePetDto,
  PaginationQuery,
  PetDto,
  PetListDto,
  UpdatePetDto,
} from './pets.dto';
import { PetsService } from './pets.service';

@ApiTags('Mascotas')
@ApiBearerAuth()
@Controller('pets')
export class PetsController {
  constructor(private readonly pets: PetsService) {}

  @Get()
  @ApiResponse({ status: 200, type: PetListDto })
  list(
    @CurrentUser() user: AuthUser,
    @Query() q: PaginationQuery,
  ): Promise<PetListDto> {
    return this.pets.list(user.id, q);
  }

  @Post()
  @ApiResponse({ status: 201, type: PetDto })
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreatePetDto,
  ): Promise<PetDto> {
    return this.pets.create(user.id, dto);
  }

  @Get(':petId')
  @ApiResponse({ status: 200, type: PetDto })
  @ApiResponse({ status: 404, description: 'PET_NOT_FOUND' })
  get(
    @CurrentUser() user: AuthUser,
    @Param('petId') petId: string,
  ): Promise<PetDto> {
    return this.pets.get(user.id, petId);
  }

  @Patch(':petId')
  @ApiResponse({ status: 200, type: PetDto })
  @ApiResponse({ status: 404, description: 'PET_NOT_FOUND' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('petId') petId: string,
    @Body() dto: UpdatePetDto,
  ): Promise<PetDto> {
    return this.pets.update(user.id, petId, dto);
  }

  @Delete(':petId')
  @HttpCode(204)
  @ApiResponse({ status: 204 })
  @ApiResponse({ status: 404, description: 'PET_NOT_FOUND' })
  remove(
    @CurrentUser() user: AuthUser,
    @Param('petId') petId: string,
  ): Promise<void> {
    return this.pets.remove(user.id, petId);
  }
}
