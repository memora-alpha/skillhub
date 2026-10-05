import { Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { IdentityEmailJobs } from "../../application/ports/identity-email-providers";
@Injectable()
export class BullIdentityEmailJobs extends IdentityEmailJobs {
  constructor(@InjectQueue("identity-email") private readonly queue: Queue) {
    super();
  }
  async enqueue(id: string, attempts: number): Promise<void> {
    await this.queue.add(
      "deliver",
      { id },
      {
        jobId: `${id}-${attempts}`,
        attempts: 1,
        removeOnComplete: true,
        removeOnFail: true,
      },
    );
  }
}
