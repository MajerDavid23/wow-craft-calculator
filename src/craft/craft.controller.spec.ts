import { Test, TestingModule } from '@nestjs/testing';
import { CraftController } from './craft.controller.js';
import { CraftService } from './craft.service.js';
import { BlizzardApiService } from '../blizzard-api.service.js';

describe('CraftController', () => {
  let controller: CraftController;

  beforeEach(async () => {
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
});
