import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { IdempotencyService } from "../../../../infrastructure/idempotency/idempotency.service";
import { SkillActorService } from "../../../users/application/services/skill-actor.service";
import type { Principal } from "../../../auth/application/services/sessions.service";
import type { RequestContext } from "../../../../shared/http/request-context";
import { CreditOperationsService } from "../../../credit/application/services/credit-operations.service";
import { createTopUpQuote } from "../../domain/top-up-policy";
import { PayosTransport } from "../../infrastructure/payos-transport";
import { PaymentCheckoutWorker } from "../services/payment-checkout.worker";
import { quoteDigest } from "../services/payment-receipts.service";
import { ReadPaymentsUseCase } from "./read-payments.use-case";
import { parseVnd } from "../../../credit/domain/money";

@Injectable()
export class CreatePaymentUseCase {
  constructor(
    private readonly commands: IdempotencyService,
    private readonly actors: SkillActorService,
    private readonly credit: CreditOperationsService,
    private readonly transport: PayosTransport,
    private readonly worker: PaymentCheckoutWorker,
    private readonly reads: ReadPaymentsUseCase,
  ) {}
  async execute(
    command: { principal: Principal; key: string; context: RequestContext },
    input: { paymentAmountVnd: string; gateway: "PAYOS" },
  ) {
    const config = this.transport.config;
    if (!config.enabled)
      throw new ServiceUnavailableException("PAYMENT_PROVIDER_UNAVAILABLE");
    const quote = createTopUpQuote(
      parseVnd(input.paymentAmountVnd),
      new Date(),
    );
    const result = await this.commands.execute(
      {
        scope: command.principal.userId,
        operation: "payment:create",
        key: command.key,
        command: input,
      },
      async (tx) => {
        await this.credit.lockWallet(tx, command.principal.userId);
        const payment = await tx.payment.create({
          data: {
            userId: command.principal.userId,
            creditAmount: quote.creditUnits,
            paymentAmountVnd: quote.paymentAmountVnd,
            currency: "VND",
            gateway: "PAYOS",
            status: "CREATED",
            conversionRateVndPerCredit: quote.conversionRateVndPerCredit,
          },
        });
        const checkout = await tx.payosCheckout.create({
          data: {
            paymentId: payment.id,
            channel: config.PAYOS_CLIENT_ID,
            quoteDigest: "0".repeat(64),
            policyVersion: quote.policyVersion,
            expiresAt: quote.expiresAt,
            returnUrl: config.PAYOS_RETURN_URL,
            cancelUrl: config.PAYOS_CANCEL_URL,
          },
        });
        await tx.payment.update({
          where: { id: payment.id },
          data: { externalOrderRef: checkout.orderCode.toString() },
        });
        await tx.payosCheckout.update({
          where: { paymentId: payment.id },
          data: { quoteDigest: quoteDigest(payment, checkout) },
        });
        return { id: payment.id, status: "CREATED" };
      },
      async (tx) => {
        await this.actors.require(tx, command.principal);
      },
    );
    // Network calls run after the durable intent commits, never inside a retried DB transaction.
    await this.worker.process(result.value.id);
    return {
      data: await this.reads.detail(command.principal, result.value.id),
      replayed: result.replayed,
    };
  }
}
