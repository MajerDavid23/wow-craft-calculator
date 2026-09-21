import { of } from 'rxjs';
import { BlizzardApiService } from './blizzard-api.service.js';
import { KafkaProducerService } from './kafka/kafka-producer.service.js';

describe('BlizzardApiService', () => {
  function buildService(auctions: { item: { id: number }; unit_price: number }[]) {
    const httpService = {
      post: vi.fn().mockReturnValue(of({ data: { access_token: 'token' } })),
      get: vi.fn().mockReturnValue(of({ data: { auctions } })),
    };
    const configService = {
      get: vi.fn((key: string) =>
        ({ BLIZZARD_CLIENT_ID: 'id', BLIZZARD_CLIENT_SECRET: 'secret', BLIZZARD_REGION: 'eu' })[key],
      ),
    };
    const kafkaProducer = { publish: vi.fn().mockResolvedValue(undefined) };

    const service = new BlizzardApiService(
      httpService as never,
      configService as never,
      kafkaProducer as unknown as KafkaProducerService,
    );

    return { service, httpService, kafkaProducer };
  }

  it('publishes a price snapshot to Kafka after fetching prices', async () => {
    const { service, kafkaProducer } = buildService([{ item: { id: 236761 }, unit_price: 12300 }]);

    await service.getItemPrices([236761]);

    expect(kafkaProducer.publish).toHaveBeenCalledTimes(1);
    const [topic, message] = kafkaProducer.publish.mock.calls[0];
    expect(topic).toBe('wow-craft.item-prices');
    expect(message).toMatchObject({
      region: 'eu',
      prices: [{ itemId: 236761, priceGold: 1.23 }],
    });
    expect(typeof (message as { fetchedAt: string }).fetchedAt).toBe('string');
  });

  it('still returns prices even if Kafka publishing is a no-op (broker unavailable)', async () => {
    const { service, kafkaProducer } = buildService([{ item: { id: 236761 }, unit_price: 12300 }]);
    kafkaProducer.publish.mockResolvedValue(undefined);

    await expect(service.getItemPrices([236761])).resolves.toEqual({ 236761: 1.23 });
  });
});
