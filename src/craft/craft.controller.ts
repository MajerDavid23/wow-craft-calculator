import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { CraftService } from './craft.service.js';
import { CalculateProfitDto } from './dto/calculate-profit.dto.js';
import { BlizzardApiService } from '../blizzard-api.service.js';
import type { RecipeKey } from './recipes/index.js';
import { RecipeGuard } from './guards/recipe.guard.js';
import { PriceHistoryService } from '../kafka/price-history.service.js';

@Controller('craft')
export class CraftController {
  constructor(
    private readonly craftService: CraftService,
    private readonly blizzardApi: BlizzardApiService,
    private readonly priceHistory: PriceHistoryService,
  ) {}

  @Post('profit')
  calculateProfit(@Body() dto: CalculateProfitDto) {
    return this.craftService.calculate(dto);
  }

  @Get('recipes')
  getRecipes() {
    return this.craftService.getRecipes();
  }

  @Post('recipes/:recipeKey/profit')
  @UseGuards(RecipeGuard)
  calculateRecipeProfit(
    @Param('recipeKey') recipeKey: RecipeKey,
    @Body() dto: CalculateProfitDto,
  ) {
    return this.craftService.calculateRecipeProfit(recipeKey, dto.quantity ?? 1, {
      outputRank: dto.outputRank as 1 | 2 | undefined,
      materialRanks: dto.materialRanks,
      multicraftChance: dto.multicraftChance,
    });
  }

  @Get('price-test')
  async getPrice() {
    const price = await this.blizzardApi.getTranquilityBloomPrice();
    return {
      item: 'Tranquility Bloom',
      lowestPriceGold: price
    };
  }

  @Get('prices')
  getPriceHistory() {
    return this.priceHistory.getHistory();
  }
}