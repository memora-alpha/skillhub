import { Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { IdentityConfig } from "../../../../configs/identity.config";
import {
  IdentityEmailJobs,
  IdentityEmailPayload,
} from "../../application/ports/identity-email-providers";
@Injectable()
export class BullIdentityEmailJobs extends IdentityEmailJobs {
  constructor(
    @InjectQueue("identity-email") private readonly queue: Queue,
    private readonly config: IdentityConfig,
  ) {
    super();
  }
  async enqueue(
    id: string,
    _attempts: number,
    payload: IdentityEmailPayload,
  ): Promise<void> {
    await this.queue.add(
      "deliver",
      { id, payload },
      {
        jobId: id,
        attempts: this.config.deliveryAttempts,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: true,
        removeOnFail: {
          age: this.config.deliveryRetentionSeconds,
          count: 1000,
        },
      },
    );
  }
}
