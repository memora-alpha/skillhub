import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { InjectQueue, Processor, WorkerHost } from "@nestjs/bullmq";
import type { Job, Queue } from "bullmq";
import { ConfigService } from "@nestjs/config";
import {
  OutboxPublisherRegistry,
  type OutboxMessage,
  type OutboxPublisher,
} from "../events/outbox.types";
import { FileScanProcessor } from "./file-scan.processor";
import { OutboxDispatcher } from "../events/outbox-dispatcher";
import {
  FileContentModeration,
  fileScanBackoff,
  fileScanQueue,
  moderationRetryCode,
} from "./file-content-moderation";

export const FILE_SCAN_QUEUE = fileScanQueue;
export const FILE_SCAN_EVENT = "file.scan.requested";

function scanPayload(event: OutboxMessage): {
  fileId: string;
  generation: number;
  priority: number;
  finalizedAt?: number;
  retryAttemptId?: string;
} {
  if (
    event.type !== FILE_SCAN_EVENT ||
    event.version !== 1 ||
    !event.payload ||
    typeof event.payload !== "object" ||
    Array.isArray(event.payload) ||
    !("fileId" in event.payload) ||
    !("generation" in event.payload) ||
    typeof event.payload.fileId !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(event.payload.fileId) ||
    !Number.isInteger(event.payload.generation) ||
    Number(event.payload.generation) < 1
  ) {
    throw new Error("INVALID_FILE_SCAN_EVENT");
  }
  return {
    fileId: event.payload.fileId,
    generation: Number(event.payload.generation),
    priority:
      "largeFile" in event.payload && event.payload.largeFile === true ? 10 : 5,
    finalizedAt:
      "finalizedAt" in event.payload &&
      typeof event.payload.finalizedAt === "number"
        ? event.payload.finalizedAt
        : undefined,
    retryAttemptId:
      "retryAttemptId" in event.payload &&
      typeof event.payload.retryAttemptId === "string"
        ? event.payload.retryAttemptId
        : undefined,
  };
}

@Injectable()
export class FileScanPublisher implements OutboxPublisher, OnModuleInit {
  constructor(
    @InjectQueue(FILE_SCAN_QUEUE) private readonly queue: Queue,
    private readonly registry: OutboxPublisherRegistry,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    if (this.config.get<boolean>("STORAGE_ENABLED"))
      this.registry.register(FILE_SCAN_EVENT, this);
  }

  async publish(event: OutboxMessage): Promise<void> {
    const payload = scanPayload(event);
    await this.queue.add(
      "scan",
      {
        fileId: payload.fileId,
        generation: payload.generation,
        finalizedAt: payload.finalizedAt,
        retryAttemptId: payload.retryAttemptId,
      },
      {
        jobId: event.eventId,
        attempts: 5,
        priority: payload.priority,
        backoff: { ...fileScanBackoff, delay: 1_000, jitter: 0.25 },
        removeOnComplete: 100,
        removeOnFail: 1000,
      },
    );
  }
}

@Processor(FILE_SCAN_QUEUE, {
  concurrency: 2,
  settings: {
    backoffStrategy: (attempts, _type, error) => {
      const delay =
        error?.message === moderationRetryCode
          ? Math.min(2 ** attempts * 1_000, 15_000)
          : 65_000;
      return Math.round(delay * (0.75 + Math.random() * 0.25));
    },
  },
})
export class FileScanWorker extends WorkerHost {
  private readonly logger = new Logger(FileScanWorker.name);
  constructor(
    private readonly scanner: FileScanProcessor,
    private readonly moderation?: FileContentModeration,
    private readonly outbox?: OutboxDispatcher,
  ) {
    super();
  }

  async process(
    job: Job<{
      fileId: string;
      generation: number;
      finalizedAt?: number;
      retryAttemptId?: string;
    }>,
  ): Promise<string> {
    if (
      !/^[0-9a-f-]{36}$/i.test(job.data.fileId) ||
      !Number.isInteger(job.data.generation) ||
      job.data.generation < 1
    ) {
      throw new Error("INVALID_FILE_SCAN_JOB");
    }
    const { fileId, generation } = job.data;
    const started = performance.now();
    const queueWait =
      job.attemptsMade === 0 && job.data.finalizedAt
        ? Math.max(0, Date.now() - job.data.finalizedAt)
        : undefined;
    const sinceQueuedMs = job.timestamp
      ? Math.max(0, Date.now() - job.timestamp)
      : undefined;
    const signal = AbortSignal.timeout(120_000);
    const softTimeout = setTimeout(
      () =>
        this.logger.warn({
          fileId,
          generation,
          outcome: "SLOW_PROCESSING",
          thresholdMs: 30_000,
        }),
      30_000,
    );
    softTimeout.unref();
    try {
      const state = await this.scanner.process(fileId, generation, signal);
      this.logger.log({
        fileId,
        generation,
        state,
        attempt: job.attemptsMade + 1,
        queue_wait_duration_ms: queueWait,
        bull_wait_duration_ms: sinceQueuedMs,
        malware_scan_duration_ms: Math.round(performance.now() - started),
      });
      if (state === "READY")
        await this.moderation?.process(
          fileId,
          generation,
          job.attemptsMade + 1 >= (job.opts?.attempts ?? 1),
          signal,
          job.attemptsMade + 1,
          job.data.finalizedAt ?? (job.timestamp || undefined),
          job.data.retryAttemptId,
        );
      return state;
    } finally {
      clearTimeout(softTimeout);
      this.outbox?.wake();
    }
  }
}
