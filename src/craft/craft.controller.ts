import { Controller, Get, Post, Body } from '@nestjs/common';
import { CraftService } from './craft.service.js';
import { CalculateProfitDto } from './dto/calculate-profit.dto.js';
import { BlizzardApiService } from '../blizzard-api.service.js';

@Controller('craft')
export class CraftController {
  constructor(
    private readonly craftService: CraftService,
    private readonly blizzardApi: BlizzardApiService
  ) {}

  @Post('profit')
  calculateProfit(@Body() dto: CalculateProfitDto) {
    return this.craftService.calculate(dto);
  }

  @Get('price-test')
  async getPrice() {
    const price = await this.blizzardApi.getTranquilityBloomPrice();
    return {
      item: 'Tranquility Bloom',
      lowestPriceGold: price
    };
  }
}