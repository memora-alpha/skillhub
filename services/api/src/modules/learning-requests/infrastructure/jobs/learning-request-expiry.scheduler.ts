import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import type { Queue } from "bullmq";

@Injectable()
export class LearningRequestExpiryScheduler
  implements OnModuleInit, OnModuleDestroy
{
  private timer?: NodeJS.Timeout;
  private readonly logger = new Logger(LearningRequestExpiryScheduler.name);

  constructor(
    @InjectQueue("learning-request-expiry") private readonly queue: Queue,
  ) {}

  onModuleInit(): void {
    this.enqueue();
    this.timer = setInterval(() => this.enqueue(), 60_000);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private enqueue(): void {
    const minute = Math.floor(Date.now() / 60_000);
    void this.queue
      .add(
        "scan",
        {},
        {
          jobId: `learning-request-expiry-${minute}`,
          attempts: 3,
          backoff: { type: "exponential", delay: 1000 },
          removeOnComplete: 100,
          removeOnFail: 1000,
        },
      )
      .catch(() => this.logger.error("Expiry scan could not be queued"));
  }
}
