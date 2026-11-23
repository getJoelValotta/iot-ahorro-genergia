import { Module } from '@nestjs/common';
import { PetsModule } from '../pets/pets.module';
import { DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';

@Module({
  imports: [PetsModule],
  controllers: [DevicesController],
  providers: [DevicesService],
})
export class DevicesModule {}
