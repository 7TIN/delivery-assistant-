import { BullMqQueueBroker } from "./bullmq-broker";
import { InMemoryQueueBroker, type QueueBroker } from "./in-memory-broker";

export * from "./in-memory-broker";
export * from "./bullmq-broker";

export type QueueDriver = "in-memory" | "bullmq";

export function resolveQueueDriver(): QueueDriver {
  const raw = (Bun.env.QUEUE_DRIVER ?? "in-memory").trim().toLowerCase();

  if (raw === "bullmq") {
    return "bullmq";
  }

  if (raw !== "in-memory") {
    console.warn(`[queue] Unknown QUEUE_DRIVER='${raw}', defaulting to in-memory`);
  }

  return "in-memory";
}

export function createQueueBroker(): QueueBroker {
  const driver = resolveQueueDriver();
  console.info(`[queue] Driver selected: ${driver}`);

  if (driver === "bullmq") {
    return new BullMqQueueBroker();
  }

  return new InMemoryQueueBroker();
}
