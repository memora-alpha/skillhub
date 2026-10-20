import {
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { IdempotencyService } from "../../../../infrastructure/idempotency/idempotency.service";
import { SkillActorService } from "../../../users/application/services/skill-actor.service";
import type { Principal } from "../../../auth/application/services/sessions.service";
import type { RequestContext } from "../../../../shared/http/request-context";
import { PaymentCheckoutWorker } from "../../infrastructure/jobs/payment-checkout.worker";
import { ReadPaymentsUseCase } from "./read-payments.use-case";

@Injectable()
export class CancelPaymentUseCase {
  constructor(
    private readonly commands: IdempotencyService,
    private readonly actors: SkillActorService,
    private readonly worker: PaymentCheckoutWorker,
    private readonly reads: ReadPaymentsUseCase,
  ) {}

  async execute(
    command: { principal: Principal; key: string; context: RequestContext },
    paymentId: string,
  ) {
    await this.commands.execute(
      {
        scope: command.principal.userId,
        operation: "payment:cancel",
        key: command.key,
        command: { paymentId },
      },
      async (tx) => {
        const payment = await tx.payment.findFirst({
          where: { id: paymentId, userId: command.principal.userId },
        });
        if (!payment) throw new NotFoundException("PAYMENT_NOT_FOUND");
        this.requireCancellable(payment.status);
        return { id: payment.id, status: payment.status };
      },
      async (tx) => {
        await this.actors.require(tx, command.principal);
      },
    );
    // Revalidate the live resource even on replay. The HTTP record is not proof
    // that the external cancellation completed before a timeout or process crash.
    const current = await this.reads.detail(command.principal, paymentId);
    this.requireCancellable(current.status);
    if (["CANCELLED", "EXPIRED"].includes(current.status)) return current;
    await this.worker.cancel(paymentId);
    const result = await this.reads.detail(command.principal, paymentId);
    if (["CANCELLED", "EXPIRED"].includes(result.status)) return result;
    this.requireCancellable(result.status);
    throw new ServiceUnavailableException("PAYMENT_CANCELLATION_UNCONFIRMED");
  }

  private requireCancellable(status: string) {
    if (status === "PAID") throw new ConflictException("PAYMENT_ALREADY_PAID");
    if (status === "REVIEW")
      throw new ConflictException("PAYMENT_REVIEW_REQUIRED");
    if (!["CREATED", "PENDING", "CANCELLED", "EXPIRED"].includes(status))
      throw new ConflictException("PAYMENT_CANNOT_CANCEL");
  }
}
