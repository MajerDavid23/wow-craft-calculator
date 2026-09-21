import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { KafkaProducerService } from './kafka-producer.service.js';
import { PriceHistoryService } from './price-history.service.js';

@Module({
  imports: [ConfigModule],
  providers: [KafkaProducerService, PriceHistoryService],
  exports: [KafkaProducerService, PriceHistoryService],
})
export class KafkaModule {}
