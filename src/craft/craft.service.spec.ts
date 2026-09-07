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

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('calculates Silvermoon Health Potion profit from one auction request', async () => {
    const getItemPrices = vi.fn().mockResolvedValue({
      0: 100,
      236761: 10,
    });
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CraftService,
        {
          provide: BlizzardApiService,
          useValue: { getItemPrices },
        },
      ],
    }).compile();
    const recipeService = module.get<CraftService>(CraftService);

    await expect(
      recipeService.calculateRecipeProfit('silvermoon-health-potion'),
    ).resolves.toEqual({
      recipe: 'Silvermoon Health Potion',
      revenue: 500,
      materialCost: 560,
      profit: -60,
    });
    expect(getItemPrices).toHaveBeenCalledTimes(1);
    expect(getItemPrices).toHaveBeenCalledWith([0, 236761, 0]);
  });
});
