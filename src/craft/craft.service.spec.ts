import { Test, TestingModule } from '@nestjs/testing';
import { CraftService } from './craft.service.js';

describe('CraftService', () => {
  let service: CraftService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CraftService],
    }).compile();

    service = module.get<CraftService>(CraftService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
