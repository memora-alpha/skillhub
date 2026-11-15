import { Injectable, OnModuleInit } from "@nestjs/common";
import { InjectQueue, Processor, WorkerHost } from "@nestjs/bullmq";
import type { Job, Queue } from "bullmq";
import { ConfigService } from "@nestjs/config";
import {
  OutboxPublisherRegistry,
  type OutboxMessage,
  type OutboxPublisher,
} from "../../../../infrastructure/events/outbox.types";
import { MaterialThumbnailProcessor } from "./material-thumbnail.processor";

export const MATERIAL_THUMBNAIL_QUEUE = "material-thumbnail";
export const MATERIAL_THUMBNAIL_EVENT = "material.thumbnail.requested";

function payload(event: OutboxMessage) {
  const value = event.payload as Record<string, unknown> | null;
  if (
    event.type !== MATERIAL_THUMBNAIL_EVENT ||
    event.version !== 1 ||
    !value ||
    typeof value.thumbnailId !== "string" ||
    typeof value.generation !== "number" ||
    !Number.isInteger(value.generation) ||
    value.generation < 1
  )
    throw new Error("INVALID_MATERIAL_THUMBNAIL_EVENT");
  return { thumbnailId: value.thumbnailId, generation: value.generation };
}

@Injectable()
export class MaterialThumbnailPublisher
  implements OutboxPublisher, OnModuleInit
{
  constructor(
    @InjectQueue(MATERIAL_THUMBNAIL_QUEUE) private readonly queue: Queue,
    private readonly registry: OutboxPublisherRegistry,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    if (this.config.get<boolean>("STORAGE_ENABLED"))
      this.registry.register(MATERIAL_THUMBNAIL_EVENT, this);
  }

  async publish(event: OutboxMessage): Promise<void> {
    await this.queue.add("generate", payload(event), {
      jobId: event.eventId,
      attempts: 5,
      backoff: { type: "exponential", delay: 2_000 },
      removeOnComplete: 100,
      removeOnFail: 1_000,
    });
  }
}

@Processor(MATERIAL_THUMBNAIL_QUEUE)
export class MaterialThumbnailWorker extends WorkerHost {
  constructor(private readonly processor: MaterialThumbnailProcessor) {
    super();
  }

  process(job: Job<{ thumbnailId: string; generation: number }>) {
    return this.processor.process(job.data.thumbnailId, job.data.generation);
  }
}
