import { Kafka } from 'kafkajs';

const brokers = (process.env.KAFKA_BROKERS ?? 'localhost:9092').split(',').map((b) => b.trim());
const topic = process.env.KAFKA_PRICE_TOPIC ?? 'wow-craft.item-prices';

const kafka = new Kafka({ clientId: 'wow-craft-calculator-tail', brokers });
const consumer = kafka.consumer({ groupId: `wow-craft-calculator-tail-${Date.now()}` });

await consumer.connect();

// Topics only get created by a producer's first send, not by a consumer subscribing -
// if nothing has ever been published yet, retry until it shows up instead of crashing.
async function subscribeWithRetry(attempts = 10, delayMs = 1000) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      await consumer.subscribe({ topic, fromBeginning: true });
      return;
    } catch (error) {
      if (attempt === attempts) throw error;
      console.log(`Topic "${topic}" not available yet (attempt ${attempt}/${attempts}), retrying...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

await subscribeWithRetry();

console.log(`Listening on topic "${topic}" at ${brokers.join(',')}... (Ctrl+C to stop)`);

await consumer.run({
  eachMessage: async ({ message }) => {
    console.log(JSON.stringify(JSON.parse(message.value?.toString() ?? '{}'), null, 2));
  },
});
