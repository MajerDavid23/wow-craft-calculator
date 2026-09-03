import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { CraftController } from './craft.controller.js';
import { CraftService } from './craft.service.js';
import { BlizzardApiService } from '../blizzard-api.service.js';

@Module({
  imports: [HttpModule, ConfigModule],
  controllers: [CraftController],
  providers: [CraftService, BlizzardApiService]
})
export class CraftModule {}