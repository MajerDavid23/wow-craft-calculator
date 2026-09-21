import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Consumer, Kafka } from 'kafkajs';

export interface PriceHistoryEntry {
	priceGold: number;
	fetchedAt: string;
}

interface PriceSnapshotMessage {
	fetchedAt: string;
	prices: { itemId: number; priceGold: number }[];
}

const MAX_ENTRIES_PER_ITEM = 20;

/**
 * Consumes the price-snapshot topic that BlizzardApiService publishes to and keeps
 * a rolling in-memory window per item, so recent prices can be queried without a
 * database. Same resilience philosophy as KafkaProducerService: if the broker isn't
 * reachable, this is a no-op (empty history), never a startup failure.
 */
@Injectable()
export class PriceHistoryService implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger(PriceHistoryService.name);
	private readonly consumer: Consumer;
	private readonly topic: string;
	private readonly history = new Map<number, PriceHistoryEntry[]>();
	private connected = false;

	constructor(private readonly configService: ConfigService) {
		const brokers = (this.configService.get<string>('KAFKA_BROKERS') ?? 'localhost:9092')
			.split(',')
			.map((broker) => broker.trim());
		this.topic = this.configService.get<string>('KAFKA_PRICE_TOPIC') ?? 'wow-craft.item-prices';

		const kafka = new Kafka({
			clientId: 'wow-craft-calculator-price-history',
			brokers,
			connectionTimeout: 3000,
			retry: { retries: 1 },
			logLevel: 1, // ERROR only - we log connection issues ourselves
		});
		this.consumer = kafka.consumer({ groupId: 'wow-craft-calculator-price-history' });
	}

	async onModuleInit() {
		try {
			await this.consumer.connect();
			await this.subscribeWithRetry();
			this.connected = true;

			// run() resolves once the fetch loop is wired up, not when consumption ends -
			// fire and forget, message handling happens in the eachMessage callback below.
			void this.consumer.run({
				eachMessage: async ({ message }) => this.recordSnapshot(message.value?.toString()),
			});
		} catch (error) {
			this.logger.warn(`Could not start Kafka price history consumer: ${(error as Error).message}`);
		}
	}

	async onModuleDestroy() {
		if (this.connected) {
			await this.consumer.disconnect();
		}
	}

	getHistory(): Record<number, PriceHistoryEntry[]> {
		return Object.fromEntries(this.history);
	}

	// A brand new topic only gets created by a producer's first send, not by a
	// consumer subscribing - retry a few times in case nothing's been published yet.
	private async subscribeWithRetry(attempts = 5, delayMs = 500) {
		for (let attempt = 1; attempt <= attempts; attempt++) {
			try {
				await this.consumer.subscribe({ topic: this.topic, fromBeginning: true });
				return;
			} catch (error) {
				if (attempt === attempts) throw error;
				await new Promise((resolve) => setTimeout(resolve, delayMs));
			}
		}
	}

	private recordSnapshot(raw: string | undefined) {
		if (!raw) return;

		try {
			const payload = JSON.parse(raw) as PriceSnapshotMessage;
			for (const { itemId, priceGold } of payload.prices) {
				const entries = this.history.get(itemId) ?? [];
				entries.push({ priceGold, fetchedAt: payload.fetchedAt });
				if (entries.length > MAX_ENTRIES_PER_ITEM) {
					entries.shift();
				}
				this.history.set(itemId, entries);
			}
		} catch (error) {
			this.logger.warn(`Failed to parse price snapshot message: ${(error as Error).message}`);
		}
	}
}
