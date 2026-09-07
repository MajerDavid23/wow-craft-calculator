import { Injectable } from '@nestjs/common';
import { CalculateProfitDto } from './dto/calculate-profit.dto.js';
import { BlizzardApiService } from '../blizzard-api.service.js';
import { RECIPES, RecipeKey } from './recipes/index.js';

@Injectable()
export class CraftService {
	constructor(private readonly blizzardApi: BlizzardApiService) {}

	calculate(dto: CalculateProfitDto) {
		const quantity = dto.quantity ?? 1;
		const revenue = (dto.salePrice ?? 0) * quantity;
		const profit = revenue - (dto.materialCost ?? 0);

		return { revenue, profit };
	}

	getRecipes() {
		return Object.values(RECIPES).map(({ key, name }) => ({ key, name }));
	}

	async calculateRecipeProfit(recipeKey: RecipeKey, quantity = 1) {
		const recipe = RECIPES[recipeKey];
		const itemIds = [recipe.output.itemId, ...recipe.materials.map((material) => material.itemId)];
		const prices = await this.blizzardApi.getItemPrices(itemIds);
		const outputPrice = prices[recipe.output.itemId] ?? 0;
		const revenue = outputPrice * recipe.output.quantity * quantity;
		const materialCost = recipe.materials.reduce(
			(total, material) => total + (prices[material.itemId] ?? 0) * material.quantity * quantity,
			0,
		);

		return {
			recipe: recipe.name,
			revenue,
			materialCost,
			profit: revenue - materialCost,
		};
	}
}
