import { Queue, Worker, type JobsOptions } from "bullmq";
import IORedis from "ioredis";

import type { QueueEventMap, QueueEventName } from "../../contracts/src";
import type { QueueBroker, QueueHandler } from "./in-memory-broker";

interface BullMqQueueBrokerOptions {
  redisUrl?: string;
  queuePrefix?: string;
  maxAttempts?: number;
  baseBackoffMs?: number;
  workerConcurrency?: number;
  removeOnCompleteCount?: number;
  removeOnFailCount?: number;
}

type AnyQueuePayload = QueueEventMap[QueueEventName];

export class BullMqQueueBroker implements QueueBroker {
  private readonly connection: IORedis;
  private readonly redisDisplayUrl: string;
  private readonly queuePrefix: string;
  private readonly maxAttempts: number;
  private readonly baseBackoffMs: number;
  private readonly workerConcurrency: number;
  private readonly removeOnCompleteCount: number;
  private readonly removeOnFailCount: number;

  private readonly queues = new Map<QueueEventName, Queue<AnyQueuePayload>>();
  private readonly workers = new Set<Worker<AnyQueuePayload>>();

  private closed = false;

  constructor(options: BullMqQueueBrokerOptions = {}) {
    this.queuePrefix = options.queuePrefix ?? Bun.env.QUEUE_PREFIX ?? "delivery";
    this.maxAttempts = options.maxAttempts ?? Number(Bun.env.QUEUE_MAX_ATTEMPTS ?? 3);
    this.baseBackoffMs = options.baseBackoffMs ?? Number(Bun.env.QUEUE_BASE_BACKOFF_MS ?? 200);
    this.workerConcurrency =
      options.workerConcurrency ?? Number(Bun.env.QUEUE_WORKER_CONCURRENCY ?? 5);
    this.removeOnCompleteCount =
      options.removeOnCompleteCount ?? Number(Bun.env.QUEUE_REMOVE_ON_COMPLETE_COUNT ?? 500);
    this.removeOnFailCount =
      options.removeOnFailCount ?? Number(Bun.env.QUEUE_REMOVE_ON_FAIL_COUNT ?? 500);

    const redisUrl = options.redisUrl ?? Bun.env.REDIS_URL ?? "redis://127.0.0.1:6379";
    this.redisDisplayUrl = sanitizeRedisUrl(redisUrl);

    this.connection = new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
    });

    this.connection.on("ready", () => {
      console.info(`[bullmq] Redis connected (${this.redisDisplayUrl})`);
    });

    this.connection.on("error", (error) => {
      console.error(`[bullmq] Redis connection error (${this.redisDisplayUrl})`, error);
    });

    this.connection.on("end", () => {
      console.warn(`[bullmq] Redis connection closed (${this.redisDisplayUrl})`);
    });

    this.connection.on("reconnecting", () => {
      console.warn(`[bullmq] Redis reconnecting (${this.redisDisplayUrl})`);
    });

    void this.logInitialRedisStatus();
  }

  async publish<K extends QueueEventName>(
    eventName: K,
    payload: QueueEventMap[K],
  ): Promise<void> {
    ensureNotClosed(this.closed);

    const queue = this.getQueue(eventName);
    await queue.add(eventName, payload as AnyQueuePayload, this.getJobOptions());
  }

  subscribe<K extends QueueEventName>(
    eventName: K,
    handler: QueueHandler<K>,
  ): () => void {
    ensureNotClosed(this.closed);

    const queue = this.getQueue(eventName);

    const worker = new Worker<AnyQueuePayload>(
      queue.name,
      async (job) => {
        await handler(job.data as QueueEventMap[K]);
      },
      {
        connection: this.connection,
        prefix: this.queuePrefix,
        concurrency: this.workerConcurrency,
      },
    );

    worker.on("failed", (job, error) => {
      console.error(
        `[bullmq] worker failed event=${eventName} jobId=${job?.id ?? "unknown"}`,
        error,
      );
    });

    this.workers.add(worker);

    return () => {
      this.workers.delete(worker);
      void worker.close();
    };
  }

  async close(): Promise<void> {
    if (this.closed) {
      return;
    }

    this.closed = true;

    const workerCloseTasks = [...this.workers].map((worker) => worker.close());
    await Promise.allSettled(workerCloseTasks);
    this.workers.clear();

    const queueCloseTasks = [...this.queues.values()].map((queue) => queue.close());
    await Promise.allSettled(queueCloseTasks);
    this.queues.clear();

    await this.connection.quit();
  }

  private getQueue(eventName: QueueEventName): Queue<AnyQueuePayload> {
    const existing = this.queues.get(eventName);
    if (existing) {
      return existing;
    }

    const queue = new Queue<AnyQueuePayload>(eventName, {
      connection: this.connection,
      prefix: this.queuePrefix,
      defaultJobOptions: this.getJobOptions(),
    });

    this.queues.set(eventName, queue);
    return queue;
  }

  private getJobOptions(): JobsOptions {
    return {
      attempts: this.maxAttempts,
      backoff: {
        type: "exponential",
        delay: this.baseBackoffMs,
      },
      removeOnComplete: {
        count: this.removeOnCompleteCount,
      },
      removeOnFail: {
        count: this.removeOnFailCount,
      },
    };
  }

  private async logInitialRedisStatus(): Promise<void> {
    try {
      const pong = await this.connection.ping();
      if (pong === "PONG") {
        console.info(`[bullmq] Redis ping success (${this.redisDisplayUrl})`);
      } else {
        console.warn(`[bullmq] Redis ping unexpected response: ${pong}`);
      }
    } catch (error) {
      console.error(`[bullmq] Redis not connected (${this.redisDisplayUrl})`, error);
    }
  }
}

function ensureNotClosed(closed: boolean): void {
  if (closed) {
    throw new Error("BullMqQueueBroker is closed");
  }
}

function sanitizeRedisUrl(redisUrl: string): string {
  try {
    const parsed = new URL(redisUrl);
    if (parsed.password) {
      parsed.password = "***";
    }
    return parsed.toString();
  } catch {
    return redisUrl;
  }
}
