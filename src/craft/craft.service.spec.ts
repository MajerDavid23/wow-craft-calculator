import { Test, TestingModule } from '@nestjs/testing';
import { CraftService } from './craft.service.js';
import { BlizzardApiService } from '../blizzard-api.service.js';

describe('CraftService', () => {
  let service: CraftService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CraftService,
        {
          provide: BlizzardApiService,
          useValue: { getItemPrices: vi.fn() },
        },
      ],
    }).compile();

    service = module.get<CraftService>(CraftService);
  });

  async function buildService(getItemPrices: ReturnType<typeof vi.fn>) {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CraftService,
        {
          provide: BlizzardApiService,
          useValue: { getItemPrices },
        },
      ],
    }).compile();
    return module.get<CraftService>(CraftService);
  }

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('calculates Silvermoon Health Potion profit at rank 1 (default) from one auction request', async () => {
    const getItemPrices = vi.fn().mockResolvedValue({
      241305: 100,
      236761: 10,
      240991: 8,
    });
    const recipeService = await buildService(getItemPrices);

    await expect(
      recipeService.calculateRecipeProfit('silvermoon-health-potion'),
    ).resolves.toEqual({
      recipe: 'Silvermoon Health Potion',
      outputRank: 1,
      revenue: 500,
      materialCost: 100,
      profit: 400,
      materials: [
        { name: 'Tranquility Bloom', rank: 1, quantity: 6, itemId: 236761, unitPrice: 10, cost: 60 },
        { name: 'Sunglass Vial', rank: 1, quantity: 5, itemId: 240991, unitPrice: 8, cost: 40 },
      ],
    });
    expect(getItemPrices).toHaveBeenCalledTimes(1);
    expect(getItemPrices).toHaveBeenCalledWith([241305, 236761, 240991]);
  });

  it('prices rank 2 output and a full-quantity per-material rank override', async () => {
    const getItemPrices = vi.fn().mockResolvedValue({
      241304: 150,
      236767: 20,
      240991: 8,
    });
    const recipeService = await buildService(getItemPrices);

    await expect(
      recipeService.calculateRecipeProfit('silvermoon-health-potion', 1, {
        outputRank: 2,
        materialRanks: { 'Tranquility Bloom': [{ rank: 2, quantity: 6 }] },
      }),
    ).resolves.toEqual({
      recipe: 'Silvermoon Health Potion',
      outputRank: 2,
      revenue: 750,
      materialCost: 160,
      profit: 590,
      materials: [
        { name: 'Tranquility Bloom', rank: 2, quantity: 6, itemId: 236767, unitPrice: 20, cost: 120 },
        { name: 'Sunglass Vial', rank: 1, quantity: 5, itemId: 240991, unitPrice: 8, cost: 40 },
      ],
    });
    expect(getItemPrices).toHaveBeenCalledWith([241304, 236767, 240991]);
  });

  it('splits a single material across multiple ranks (e.g. 2x rank 2 vial + 3x rank 1 vial)', async () => {
    const getItemPrices = vi.fn().mockResolvedValue({
      241305: 100,
      236761: 10,
      240990: 50,
      240991: 8,
    });
    const recipeService = await buildService(getItemPrices);

    await expect(
      recipeService.calculateRecipeProfit('silvermoon-health-potion', 1, {
        materialRanks: {
          'Sunglass Vial': [
            { rank: 2, quantity: 2 },
            { rank: 1, quantity: 3 },
          ],
        },
      }),
    ).resolves.toEqual({
      recipe: 'Silvermoon Health Potion',
      outputRank: 1,
      revenue: 500,
      materialCost: 184,
      profit: 316,
      materials: [
        { name: 'Tranquility Bloom', rank: 1, quantity: 6, itemId: 236761, unitPrice: 10, cost: 60 },
        { name: 'Sunglass Vial', rank: 2, quantity: 2, itemId: 240990, unitPrice: 50, cost: 100 },
        { name: 'Sunglass Vial', rank: 1, quantity: 3, itemId: 240991, unitPrice: 8, cost: 24 },
      ],
    });
    expect(getItemPrices).toHaveBeenCalledWith([241305, 236761, 240990, 240991]);
  });

  it('scales required quantity by craft quantity when validating rank splits', async () => {
    const getItemPrices = vi.fn().mockResolvedValue({
      241305: 100,
      236761: 10,
      240990: 50,
      240991: 8,
    });
    const recipeService = await buildService(getItemPrices);

    // Sunglass Vial requires 5 per craft; quantity: 2 crafts => 10 total required.
    await expect(
      recipeService.calculateRecipeProfit('silvermoon-health-potion', 2, {
        materialRanks: {
          'Sunglass Vial': [
            { rank: 2, quantity: 4 },
            { rank: 1, quantity: 6 },
          ],
        },
      }),
    ).resolves.toMatchObject({ outputRank: 1 });
  });

  it('rejects a rank split that does not add up to the required quantity', async () => {
    const getItemPrices = vi.fn();
    const recipeService = await buildService(getItemPrices);

    await expect(
      recipeService.calculateRecipeProfit('silvermoon-health-potion', 1, {
        materialRanks: {
          'Sunglass Vial': [
            { rank: 2, quantity: 2 },
            { rank: 1, quantity: 2 },
          ],
        },
      }),
    ).rejects.toThrow('Material "Sunglass Vial" requires 5 total across ranks, got 4');
  });

  it('rejects a negative rank quantity', async () => {
    const getItemPrices = vi.fn();
    const recipeService = await buildService(getItemPrices);

    await expect(
      recipeService.calculateRecipeProfit('silvermoon-health-potion', 1, {
        materialRanks: {
          'Sunglass Vial': [{ rank: 1, quantity: -1 }],
        },
      }),
    ).rejects.toThrow('Material "Sunglass Vial" rank 1 quantity cannot be negative');
  });

  it('rejects an unknown output rank', async () => {
    const getItemPrices = vi.fn();
    const recipeService = await buildService(getItemPrices);

    await expect(
      recipeService.calculateRecipeProfit('silvermoon-health-potion', 1, {
        outputRank: 3 as 1 | 2,
      }),
    ).rejects.toThrow('Recipe "Silvermoon Health Potion" output has no rank 3');
  });

  it('rejects an unknown material rank', async () => {
    const getItemPrices = vi.fn();
    const recipeService = await buildService(getItemPrices);

    await expect(
      recipeService.calculateRecipeProfit('silvermoon-health-potion', 1, {
        materialRanks: { 'Sunglass Vial': [{ rank: 3, quantity: 5 }] },
      }),
    ).rejects.toThrow('Material "Sunglass Vial" has no rank 3');
  });
});
