import { Injectable, OnModuleInit } from "@nestjs/common";
import { InjectQueue, Processor, WorkerHost } from "@nestjs/bullmq";
import type { Job, Queue } from "bullmq";
import { z } from "zod";
import {
  OutboxPublisherRegistry,
  type OutboxMessage,
  type OutboxPublisher,
} from "../../../../infrastructure/events/outbox.types";
import { VerificationAiService } from "../../application/services/verification-ai.service";
import {
  AI_EVENT,
  AI_QUEUE,
  AI_MAX_ATTEMPTS,
} from "../../domain/verification-ai.config";

const payloadSchema = z.strictObject({ analysisId: z.uuid() });

@Injectable()
export class VerificationAiPublisher implements OutboxPublisher, OnModuleInit {
  constructor(
    @InjectQueue(AI_QUEUE) private readonly queue: Queue,
    private readonly registry: OutboxPublisherRegistry,
  ) {}
  onModuleInit() {
    this.registry.register(AI_EVENT, this);
  }
  async publish(event: OutboxMessage) {
    const payload = payloadSchema.safeParse(event.payload);
    if (event.type !== AI_EVENT || event.version !== 1 || !payload.success)
      throw new Error("INVALID_AI_EVENT");
    await this.queue.add("analyze", payload.data, {
      jobId: event.eventId,
      attempts: AI_MAX_ATTEMPTS,
      backoff: { type: "exponential", delay: 10000 },
      removeOnComplete: 100,
      removeOnFail: 1000,
    });
  }
}

@Processor(AI_QUEUE, { concurrency: 1, limiter: { max: 10, duration: 60000 } })
export class VerificationAiWorker extends WorkerHost {
  constructor(private readonly service: VerificationAiService) {
    super();
  }
  async process(job: Job<{ analysisId: string }>) {
    const payload = payloadSchema.safeParse(job.data);
    if (!payload.success) throw new Error("INVALID_AI_JOB");
    return this.service.process(payload.data.analysisId);
  }
}
