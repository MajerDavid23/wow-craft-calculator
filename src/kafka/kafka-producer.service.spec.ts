import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { KafkaProducerService } from './kafka-producer.service.js';

const connect = vi.fn();
const disconnect = vi.fn();
const send = vi.fn();

vi.mock('kafkajs', () => ({
  Kafka: vi.fn().mockImplementation(function KafkaMock(this: { producer: () => unknown }) {
    this.producer = () => ({ connect, disconnect, send });
  }),
}));

describe('KafkaProducerService', () => {
  beforeEach(() => {
    connect.mockReset();
    disconnect.mockReset();
    send.mockReset();
  });

  async function buildService(configValues: Record<string, string> = {}) {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KafkaProducerService,
        {
          provide: ConfigService,
          useValue: { get: (key: string) => configValues[key] },
        },
      ],
    }).compile();
    return module.get<KafkaProducerService>(KafkaProducerService);
  }

  it('publishes a message once connected', async () => {
    connect.mockResolvedValue(undefined);
    const service = await buildService();

    await service.onModuleInit();
    await service.publish('wow-craft.item-prices', { foo: 'bar' });

    expect(send).toHaveBeenCalledWith({
      topic: 'wow-craft.item-prices',
      messages: [{ value: JSON.stringify({ foo: 'bar' }) }],
    });
  });

  it('skips publishing without throwing when the broker is unreachable', async () => {
    connect.mockRejectedValue(new Error('connect ECONNREFUSED'));
    const service = await buildService();

    await service.onModuleInit();
    await expect(service.publish('wow-craft.item-prices', { foo: 'bar' })).resolves.toBeUndefined();

    expect(send).not.toHaveBeenCalled();
  });

  it('disconnects on module destroy only if it connected', async () => {
    connect.mockRejectedValue(new Error('connect ECONNREFUSED'));
    const service = await buildService();

    await service.onModuleInit();
    await service.onModuleDestroy();

    expect(disconnect).not.toHaveBeenCalled();
  });
});
