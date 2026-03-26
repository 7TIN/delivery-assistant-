import type { QueueEventMap, QueueEventName } from "../../contracts/src";
import type { QueueBroker } from "./in-memory-broker";

export class BullMqQueueBroker implements QueueBroker {
  constructor() {
    throw new Error(
      "BullMqQueueBroker requires `bullmq` and `ioredis` dependencies. Install them and replace this placeholder implementation.",
    );
  }

  async publish<K extends QueueEventName>(
    _eventName: K,
    _payload: QueueEventMap[K],
  ): Promise<void> {
    return Promise.resolve();
  }

  subscribe<K extends QueueEventName>(
    _eventName: K,
    _handler: (payload: QueueEventMap[K]) => void | Promise<void>,
  ): () => void {
    return () => undefined;
  }
}
