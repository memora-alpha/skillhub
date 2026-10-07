import { Injectable, OnModuleInit } from "@nestjs/common";
import { InjectQueue, Processor, WorkerHost } from "@nestjs/bullmq";
import type { Job, Queue } from "bullmq";
import { ConfigService } from "@nestjs/config";
import {
  OutboxPublisherRegistry,
  type OutboxMessage,
  type OutboxPublisher,
} from "../events/outbox.types";
import { FileScanProcessor } from "./file-scan.processor";

export const FILE_SCAN_QUEUE = "file-scan";
export const FILE_SCAN_EVENT = "file.scan.requested";

function scanPayload(event: OutboxMessage): {
  fileId: string;
  generation: number;
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
    await this.queue.add("scan", payload, {
      jobId: event.eventId,
      attempts: 5,
      backoff: { type: "fixed", delay: 65_000 },
      removeOnComplete: 100,
      removeOnFail: 1000,
    });
  }
}

@Processor(FILE_SCAN_QUEUE)
export class FileScanWorker extends WorkerHost {
  constructor(private readonly scanner: FileScanProcessor) {
    super();
  }

  async process(
    job: Job<{ fileId: string; generation: number }>,
  ): Promise<string> {
    if (
      !/^[0-9a-f-]{36}$/i.test(job.data.fileId) ||
      !Number.isInteger(job.data.generation) ||
      job.data.generation < 1
    ) {
      throw new Error("INVALID_FILE_SCAN_JOB");
    }
    return this.scanner.process(job.data.fileId, job.data.generation);
  }
}
