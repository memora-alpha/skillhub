import { Processor, WorkerHost } from "@nestjs/bullmq";
import type { Job } from "bullmq";
import { ExpireLearningRequestsUseCase } from "../../application/use-cases/expire-learning-requests.use-case";

@Processor("learning-request-expiry")
export class LearningRequestExpiryWorker extends WorkerHost {
  constructor(private readonly expire: ExpireLearningRequestsUseCase) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name !== "scan") throw new Error("Unknown expiry job");
    await this.expire.execute(100);
  }
}
