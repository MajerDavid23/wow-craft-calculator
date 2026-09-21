import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PriceHistoryService } from './price-history.service.js';

const connect = vi.fn();
const disconnect = vi.fn();
const subscribe = vi.fn();
const run = vi.fn();

vi.mock('kafkajs', () => ({
  Kafka: vi.fn().mockImplementation(function KafkaMock(this: { consumer: () => unknown }) {
    this.consumer = () => ({ connect, disconnect, subscribe, run });
  }),
}));

function snapshotMessage(fetchedAt: string, prices: { itemId: number; priceGold: number }[]) {
  return { value: Buffer.from(JSON.stringify({ fetchedAt, prices })) };
}

describe('PriceHistoryService', () => {
  beforeEach(() => {
    connect.mockReset();
    disconnect.mockReset();
    subscribe.mockReset();
    run.mockReset();
  });

  async function buildService() {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PriceHistoryService,
        {
          provide: ConfigService,
          useValue: { get: () => undefined },
        },
      ],
    }).compile();
    return module.get<PriceHistoryService>(PriceHistoryService);
  }

  it('records prices from consumed messages into history, keyed by item id', async () => {
    connect.mockResolvedValue(undefined);
    subscribe.mockResolvedValue(undefined);
    let eachMessage: (args: { message: { value: Buffer } }) => Promise<void>;
    run.mockImplementation(async (handlers) => {
      eachMessage = handlers.eachMessage;
    });

    const service = await buildService();
    await service.onModuleInit();

    await eachMessage!({
      message: snapshotMessage('2026-01-01T00:00:00.000Z', [
        { itemId: 236761, priceGold: 1.23 },
        { itemId: 240991, priceGold: 2.87 },
      ]),
    });

    expect(service.getHistory()).toEqual({
      236761: [{ priceGold: 1.23, fetchedAt: '2026-01-01T00:00:00.000Z' }],
      240991: [{ priceGold: 2.87, fetchedAt: '2026-01-01T00:00:00.000Z' }],
    });
  });

  it('keeps only the most recent 20 entries per item', async () => {
    connect.mockResolvedValue(undefined);
    subscribe.mockResolvedValue(undefined);
    let eachMessage: (args: { message: { value: Buffer } }) => Promise<void>;
    run.mockImplementation(async (handlers) => {
      eachMessage = handlers.eachMessage;
    });

    const service = await buildService();
    await service.onModuleInit();

    for (let i = 0; i < 25; i++) {
      await eachMessage!({
        message: snapshotMessage(`entry-${i}`, [{ itemId: 236761, priceGold: i }]),
      });
    }

    const entries = service.getHistory()[236761];
    expect(entries).toHaveLength(20);
    expect(entries[0]).toEqual({ priceGold: 5, fetchedAt: 'entry-5' });
    expect(entries[19]).toEqual({ priceGold: 24, fetchedAt: 'entry-24' });
  });

  it('returns empty history without throwing when the broker is unreachable', async () => {
    connect.mockRejectedValue(new Error('connect ECONNREFUSED'));

    const service = await buildService();
    await expect(service.onModuleInit()).resolves.toBeUndefined();

    expect(service.getHistory()).toEqual({});
  });

  it('ignores an unparseable message instead of throwing', async () => {
    connect.mockResolvedValue(undefined);
    subscribe.mockResolvedValue(undefined);
    let eachMessage: (args: { message: { value: Buffer } }) => Promise<void>;
    run.mockImplementation(async (handlers) => {
      eachMessage = handlers.eachMessage;
    });

    const service = await buildService();
    await service.onModuleInit();

    await expect(eachMessage!({ message: { value: Buffer.from('not json') } })).resolves.toBeUndefined();
    expect(service.getHistory()).toEqual({});
  });

  it('disconnects on module destroy only if it connected', async () => {
    connect.mockRejectedValue(new Error('connect ECONNREFUSED'));
    const service = await buildService();

    await service.onModuleInit();
    await service.onModuleDestroy();

    expect(disconnect).not.toHaveBeenCalled();
  });
});
