import { BadRequestException, Injectable } from '@nestjs/common';
import { CalculateProfitDto, MaterialRankAllocationDto } from './dto/calculate-profit.dto.js';
import { BlizzardApiService } from '../blizzard-api.service.js';
import { RECIPES, RecipeKey, RecipeRank } from './recipes/index.js';

export interface RecipeProfitOptions {
	outputRank?: RecipeRank;
	materialRanks?: Record<string, MaterialRankAllocationDto[]>;
}

export interface PricedMaterialLine {
	name: string;
	rank: number;
	quantity: number;
	itemId: number;
	unitPrice: number;
	cost: number;
}

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
		return Object.values(RECIPES).map((recipe) => ({
			key: recipe.key,
			name: recipe.name,
			outputRanks: Object.keys(recipe.output.ranks).map(Number),
			materials: recipe.materials.map((material) => ({
				name: material.name,
				quantity: material.quantity,
				ranks: Object.keys(material.ranks).map(Number),
			})),
		}));
	}

	async calculateRecipeProfit(recipeKey: RecipeKey, quantity = 1, options: RecipeProfitOptions = {}) {
		const recipe = RECIPES[recipeKey];
		const outputRank = options.outputRank ?? 1;
		const outputItemId = this.resolveRankItemId(recipe.output.ranks, outputRank, `Recipe "${recipe.name}" output`);

		const materialLines = recipe.materials.flatMap((material) => {
			const requiredQuantity = material.quantity * quantity;
			const allocations = options.materialRanks?.[material.name] ?? [{ rank: 1, quantity: requiredQuantity }];

			const quantityByRank = new Map<number, number>();
			for (const allocation of allocations) {
				if (allocation.quantity < 0) {
					throw new BadRequestException(
						`Material "${material.name}" rank ${allocation.rank} quantity cannot be negative`,
					);
				}
				quantityByRank.set(allocation.rank, (quantityByRank.get(allocation.rank) ?? 0) + allocation.quantity);
			}

			const allocatedTotal = [...quantityByRank.values()].reduce((sum, qty) => sum + qty, 0);
			if (allocatedTotal !== requiredQuantity) {
				throw new BadRequestException(
					`Material "${material.name}" requires ${requiredQuantity} total across ranks, got ${allocatedTotal}`,
				);
			}

			return [...quantityByRank.entries()]
				.filter(([, materialQuantity]) => materialQuantity > 0)
				.map(([rank, materialQuantity]) => ({
					name: material.name,
					rank,
					quantity: materialQuantity,
					itemId: this.resolveRankItemId(material.ranks, rank, `Material "${material.name}"`),
				}));
		});

		const itemIds = [...new Set([outputItemId, ...materialLines.map((line) => line.itemId)])];
		const prices = await this.blizzardApi.getItemPrices(itemIds);

		const outputPrice = prices[outputItemId] ?? 0;
		const revenue = outputPrice * recipe.output.quantity * quantity;

		const pricedMaterials: PricedMaterialLine[] = materialLines.map((line) => {
			const unitPrice = prices[line.itemId] ?? 0;
			return { ...line, unitPrice, cost: unitPrice * line.quantity };
		});
		const materialCost = pricedMaterials.reduce((total, line) => total + line.cost, 0);

		return {
			recipe: recipe.name,
			outputRank,
			revenue,
			materialCost,
			profit: revenue - materialCost,
			materials: pricedMaterials,
		};
	}

	private resolveRankItemId(ranks: Record<number, { itemId: number }>, rank: number, label: string): number {
		const variant = ranks[rank];
		if (!variant) {
			throw new BadRequestException(`${label} has no rank ${rank}`);
		}
		return variant.itemId;
	}
}
