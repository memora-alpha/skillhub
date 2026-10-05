import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { ProcessAvatarUseCase } from "../../application/use-cases/process-avatar.use-case";
@Processor("identity-avatar")
export class AvatarWorker extends WorkerHost {
  constructor(private readonly work: ProcessAvatarUseCase) {
    super();
  }
  async process(job: Job<{ id: string }>) {
    await this.work.execute(job.data.id);
  }
}
