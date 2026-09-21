import { BadRequestException, Injectable } from '@nestjs/common';
import { CalculateProfitDto, MaterialRankAllocationDto } from './dto/calculate-profit.dto.js';
import { BlizzardApiService } from '../blizzard-api.service.js';
import { RECIPES, RecipeKey, RecipeRank } from './recipes/index.js';

export interface RecipeProfitOptions {
	outputRank?: RecipeRank;
	materialRanks?: Record<string, MaterialRankAllocationDto[]>;
	multicraftChance?: number;
}

export interface MulticraftBreakdown {
	chancePercent: number;
	/** Expected number of cost-free bonus items already folded into `revenue`/`profit` above, for this request's `quantity`. */
	multicraftAmount: number;
	/** Profit represented by those bonus items (already included in `profit` above - shown separately for visibility). */
	multicraftExtraProfit: number;
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
		const baseItems = recipe.output.quantity * quantity;

		let totalItems = baseItems;
		let multicraft: MulticraftBreakdown | undefined;
		if (options.multicraftChance !== undefined) {
			const chancePercent = options.multicraftChance;
			if (chancePercent < 0 || chancePercent > 100) {
				throw new BadRequestException(`multicraftChance must be between 0 and 100, got ${chancePercent}`);
			}

			// Multicraft only affects the output side (bonus items cost no extra reagents):
			// expected value multiplier = 1 + (chance × 1.5), per community-derived testing
			// (thelazygoldmaker.com's crafting stats breakdown). Every bonus item sells at
			// the same price as a normal one, so that multiplier applies to item count too.
			totalItems = baseItems * (1 + (chancePercent / 100) * 1.5);
			const multicraftAmount = Math.round(totalItems - baseItems);
			multicraft = {
				chancePercent,
				multicraftAmount,
				multicraftExtraProfit: Math.round(outputPrice * multicraftAmount * 100) / 100,
			};
		}

		const revenue = outputPrice * totalItems;

		const pricedMaterials: PricedMaterialLine[] = materialLines.map((line) => {
			const unitPrice = prices[line.itemId] ?? 0;
			return { ...line, unitPrice, cost: unitPrice * line.quantity };
		});
		const materialCost = pricedMaterials.reduce((total, line) => total + line.cost, 0);

		return {
			recipe: recipe.name,
			outputRank,
			revenue,
			...(multicraft ? { multicraft } : {}),
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
