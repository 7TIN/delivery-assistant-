import { BullMqQueueBroker } from "./bullmq-broker";
import { InMemoryQueueBroker, type QueueBroker } from "./in-memory-broker";

export * from "./in-memory-broker";
export * from "./bullmq-broker";

export function createQueueBroker(): QueueBroker {
  const driver = Bun.env.QUEUE_DRIVER ?? "in-memory";

  if (driver === "bullmq") {
    return new BullMqQueueBroker();
  }

  return new InMemoryQueueBroker();
}
