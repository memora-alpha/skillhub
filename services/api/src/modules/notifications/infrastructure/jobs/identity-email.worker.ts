import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { DeliverIdentityEmailUseCase } from "../../application/use-cases/deliver-identity-email.use-case";
@Processor("identity-email")
export class IdentityEmailWorker extends WorkerHost {
  constructor(private readonly work: DeliverIdentityEmailUseCase) {
    super();
  }
  async process(job: Job<{ id: string }>) {
    await this.work.execute(job.data.id);
  }
}
