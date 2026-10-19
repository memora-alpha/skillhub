import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { IdentityEmailPayload } from "../../application/ports/identity-email-providers";
import { DeliverIdentityEmailUseCase } from "../../application/use-cases/deliver-identity-email.use-case";
@Processor("identity-email")
export class IdentityEmailWorker extends WorkerHost {
  constructor(private readonly work: DeliverIdentityEmailUseCase) {
    super();
  }
  async process(job: Job<{ id: string; payload: IdentityEmailPayload }>) {
    await this.work.execute(job.data.id, job.data.payload);
  }
}
