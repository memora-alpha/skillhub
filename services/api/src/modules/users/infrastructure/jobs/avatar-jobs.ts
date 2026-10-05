import { Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { AvatarJobs } from "../../application/ports/avatar-providers";
@Injectable()
export class BullAvatarJobs extends AvatarJobs {
  constructor(@InjectQueue("identity-avatar") private readonly queue: Queue) {
    super();
  }
  async enqueue(id: string): Promise<void> {
    await this.queue.add(
      "scan",
      { id },
      {
        jobId: `${id}-${Math.floor(Date.now() / 60000)}`,
        attempts: 1,
        removeOnComplete: true,
        removeOnFail: true,
      },
    );
  }
}
