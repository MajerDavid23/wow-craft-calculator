import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Producer } from 'kafkajs';

@Injectable()
export class KafkaProducerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaProducerService.name);
  private readonly producer: Producer;
  private connected = false;

  constructor(private readonly configService: ConfigService) {
    const brokers = (this.configService.get<string>('KAFKA_BROKERS') ?? 'localhost:9092')
      .split(',')
      .map((broker) => broker.trim());

    const kafka = new Kafka({
      clientId: 'wow-craft-calculator',
      brokers,
      connectionTimeout: 3000,
      retry: { retries: 1 },
      logLevel: 1, // ERROR only - kafkajs is noisy about connection failures we already log ourselves
    });
    this.producer = kafka.producer();
  }

  async onModuleInit() {
    try {
      await this.producer.connect();
      this.connected = true;
    } catch (error) {
      // Kafka is a nice-to-have side channel here, not a dependency the API relies on to function.
      this.logger.warn(`Could not connect to Kafka, price snapshots will be skipped: ${(error as Error).message}`);
    }
  }

  async onModuleDestroy() {
    if (this.connected) {
      await this.producer.disconnect();
    }
  }

  async publish(topic: string, message: Record<string, unknown>): Promise<void> {
    if (!this.connected) return;

    try {
      await this.producer.send({
        topic,
        messages: [{ value: JSON.stringify(message) }],
      });
    } catch (error) {
      this.logger.warn(`Failed to publish to Kafka topic "${topic}": ${(error as Error).message}`);
    }
  }
}
