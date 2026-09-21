import { Test, TestingModule } from '@nestjs/testing';
import { CraftController } from './craft.controller.js';
import { CraftService } from './craft.service.js';
import { BlizzardApiService } from '../blizzard-api.service.js';
import { PriceHistoryService } from '../kafka/price-history.service.js';

describe('CraftController', () => {
  let controller: CraftController;
  let getHistory: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    getHistory = vi.fn().mockReturnValue({ 236761: [{ priceGold: 1.23, fetchedAt: '2026-01-01T00:00:00.000Z' }] });

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CraftController],
      providers: [
        CraftService,
        {
          provide: BlizzardApiService,
          useValue: {
            getTranquilityBloomPrice: vi.fn().mockResolvedValue(125.5),
          },
        },
        {
          provide: PriceHistoryService,
          useValue: { getHistory },
        },
      ],
    }).compile();

    controller = module.get<CraftController>(CraftController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('returns the price received from BlizzardApiService', async () => {
    await expect(controller.getPrice()).resolves.toEqual({
      item: 'Tranquility Bloom',
      lowestPriceGold: 125.5,
    });
  });

  it('returns the in-memory price history', () => {
    expect(controller.getPriceHistory()).toEqual({
      236761: [{ priceGold: 1.23, fetchedAt: '2026-01-01T00:00:00.000Z' }],
    });
    expect(getHistory).toHaveBeenCalledTimes(1);
  });
});
