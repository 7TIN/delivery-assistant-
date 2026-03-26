import type { QueueEventMap, QueueEventName } from "../../contracts/src";

export type QueueHandler<K extends QueueEventName> = (
  payload: QueueEventMap[K],
) => void | Promise<void>;

export interface QueueBroker {
  publish<K extends QueueEventName>(eventName: K, payload: QueueEventMap[K]): Promise<void>;
  subscribe<K extends QueueEventName>(
    eventName: K,
    handler: QueueHandler<K>,
  ): () => void;
}

interface BrokerOptions {
  maxAttempts?: number;
  baseBackoffMs?: number;
}

type UntypedHandler = (payload: unknown) => void | Promise<void>;

export class InMemoryQueueBroker implements QueueBroker {
  private readonly handlers = new Map<QueueEventName, UntypedHandler[]>();

  private readonly maxAttempts: number;
  private readonly baseBackoffMs: number;

  constructor(options: BrokerOptions = {}) {
    this.maxAttempts = options.maxAttempts ?? 3;
    this.baseBackoffMs = options.baseBackoffMs ?? 200;
  }

  subscribe<K extends QueueEventName>(
    eventName: K,
    handler: QueueHandler<K>,
  ): () => void {
    const eventHandlers = this.handlers.get(eventName) ?? [];
    eventHandlers.push(handler as UntypedHandler);
    this.handlers.set(eventName, eventHandlers);

    return () => {
      const nextHandlers = this.handlers.get(eventName) ?? [];
      const idx = nextHandlers.indexOf(handler as UntypedHandler);
      if (idx >= 0) {
        nextHandlers.splice(idx, 1);
      }
      this.handlers.set(eventName, nextHandlers);
    };
  }

  async publish<K extends QueueEventName>(
    eventName: K,
    payload: QueueEventMap[K],
  ): Promise<void> {
    const eventHandlers = this.handlers.get(eventName) ?? [];

    await Promise.all(
      eventHandlers.map(async (handler) => {
        await this.executeWithRetry(() => handler(payload), eventName);
      }),
    );
  }

  private async executeWithRetry(
    task: () => void | Promise<void>,
    eventName: QueueEventName,
  ): Promise<void> {
    let attempt = 0;

    // Simple retry policy mirrors the v1 queue contract expectations.
    while (attempt < this.maxAttempts) {
      try {
        await task();
        return;
      } catch (error) {
        attempt += 1;
        if (attempt >= this.maxAttempts) {
          console.error(`[queue] failed event=${eventName} attempts=${attempt}`, error);
          return;
        }
        const delayMs = this.baseBackoffMs * Math.pow(2, attempt - 1);
        await sleep(delayMs);
      }
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
