import {
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { createHash } from "node:crypto";
import {
  fingerprintCommand,
  IdempotencyService,
} from "../../../../infrastructure/idempotency/idempotency.service";
import { SkillActorService } from "../../../users/application/services/skill-actor.service";
import type { Principal } from "../../../auth/application/services/sessions.service";
import type { RequestContext } from "../../../../shared/http/request-context";
import { CreditOperationsService } from "../../../credit/application/services/credit-operations.service";
import { createTopUpQuote } from "../../domain/top-up-policy";
import { PayosTransport } from "../../infrastructure/gateway/payos-transport";
import { PaymentCheckoutWorker } from "../../infrastructure/jobs/payment-checkout.worker";
import { quoteDigest } from "../services/payment-receipts.service";
import { ReadPaymentsUseCase } from "./read-payments.use-case";
import { parseVnd } from "../../../credit/domain/money";
import { PaymentCreationPolicy } from "../services/payment-creation-policy";

@Injectable()
export class CreatePaymentUseCase {
  constructor(
    private readonly commands: IdempotencyService,
    private readonly actors: SkillActorService,
    private readonly credit: CreditOperationsService,
    private readonly transport: PayosTransport,
    private readonly worker: PaymentCheckoutWorker,
    private readonly reads: ReadPaymentsUseCase,
    private readonly policy: PaymentCreationPolicy,
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
    const keyDigest = createHash("sha256").update(command.key).digest("hex");
    const fingerprint = fingerprintCommand(input);
    let recovered = false;
    const result = await this.commands.execute(
      {
        scope: command.principal.userId,
        operation: "payment:create",
        key: command.key,
        command: input,
      },
      async (tx) => {
        // Reset on each transaction retry; domain identity survives HTTP mapping loss.
        recovered = false;
        const existing = await tx.payment.findUnique({
          where: {
            userId_creationKeyDigest: {
              userId: command.principal.userId,
              creationKeyDigest: keyDigest,
            },
          },
        });
        if (existing) {
          if (
            existing.creationFingerprint !== fingerprint ||
            existing.gateway !== input.gateway ||
            existing.paymentAmountVnd !== quote.paymentAmountVnd
          )
            throw new ConflictException(
              "Idempotency key belongs to a different command",
            );
          recovered = true;
          return { id: existing.id, status: existing.status };
        }
        await this.policy.requireFresh(tx, command.principal.userId);
        await this.credit.lockWallet(tx, command.principal.userId);
        const payment = await tx.payment.create({
          data: {
            userId: command.principal.userId,
            creationKeyDigest: keyDigest,
            creationFingerprint: fingerprint,
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
    try {
      return {
        data: await this.reads.detail(command.principal, result.value.id),
        replayed: result.replayed || recovered,
      };
    } catch (error) {
      if (error instanceof NotFoundException)
        throw new ConflictException({
          message: "PAYMENT_RECONCILIATION_REQUIRED",
          existingPaymentId: result.value.id,
        });
      throw error;
    }
  }
}
