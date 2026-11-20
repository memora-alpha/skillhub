import { Injectable, type OnModuleInit } from "@nestjs/common";
import { InjectQueue, Processor, WorkerHost } from "@nestjs/bullmq";
import type { Job, Queue } from "bullmq";
import { z } from "zod";
import {
  OutboxPublisherRegistry,
  type OutboxMessage,
  type OutboxPublisher,
} from "../../../../infrastructure/events/outbox.types";
import {
  reportModerationEvent,
  reportModerationKinds,
  type ReportModerationReference,
} from "../../application/services/report-content-moderation";
import { ReportContentModerationProcessor } from "./report-content-moderation.processor";

export const reportModerationQueue = "report-content-moderation";
const referenceSchema = z
  .strictObject({
    kind: z.enum(reportModerationKinds),
    sourceId: z.string(),
  })
  .refine(({ kind, sourceId }) =>
    kind === "CASE_MESSAGE"
      ? /^[a-f0-9]{64}$/.test(sourceId)
      : z.uuid().safeParse(sourceId).success,
  );

function parseReference(data: unknown): ReportModerationReference {
  const result = referenceSchema.safeParse(data);
  if (!result.success) throw new Error("INVALID_REPORT_MODERATION_REFERENCE");
  return result.data;
}

@Injectable()
export class ReportContentModerationPublisher
  implements OnModuleInit, OutboxPublisher
{
  constructor(
    @InjectQueue(reportModerationQueue)
    private readonly queue: Queue<ReportModerationReference>,
    private readonly registry: OutboxPublisherRegistry,
  ) {}

  onModuleInit(): void {
    this.registry.register(reportModerationEvent, this);
  }

  async publish(event: OutboxMessage): Promise<void> {
    if (event.type !== reportModerationEvent || event.version !== 1)
      throw new Error("INVALID_REPORT_MODERATION_REFERENCE");
    await this.queue.add("classify", parseReference(event.payload), {
      jobId: event.eventId,
      attempts: 8,
      backoff: { type: "exponential", delay: 2_000 },
      removeOnComplete: 100,
      removeOnFail: 1_000,
    });
  }
}

@Processor(reportModerationQueue)
export class ReportContentModerationWorker extends WorkerHost {
  constructor(private readonly processor: ReportContentModerationProcessor) {
    super();
  }

  async process(job: Job<ReportModerationReference>): Promise<void> {
    const reference = parseReference(job.data);
    try {
      await this.processor.process(reference);
    } catch {
      // Job failures are persisted in Redis. Keep storage and provider errors private.
      throw new Error("REPORT_MODERATION_PROCESS_FAILED");
    }
  }
}
