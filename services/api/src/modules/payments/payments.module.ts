import { TransactionRunner } from "../../infrastructure/database/transaction-runner";
import { Module } from "@nestjs/common";
import { AdminPaymentsReader } from "./application/services/admin-payments.reader";
import { AdminPaymentsController } from "./presentation/http/admin-payments.controller";
import { PaymentReconciliationReader } from "./application/services/payment-reconciliation.reader";
import { DatabaseModule } from "../../infrastructure/database/database.module";
import { IdempotencyModule } from "../../infrastructure/idempotency/idempotency.module";
import { IdentityModule } from "../identity.module";
import { CreditModule } from "../credit/credit.module";
import { AuditModule } from "../audit/audit.module";
import { ApplicationEventsModule } from "../application-events/application-events.module";
import { IdentityConfig } from "../../configs/identity.config";
import { PayosTransport } from "./infrastructure/gateway/payos-transport";
import { PaymentCheckoutWorker } from "./infrastructure/jobs/payment-checkout.worker";
import { PaymentReceiptsService } from "./application/services/payment-receipts.service";
import { PaymentCreationPolicy } from "./application/services/payment-creation-policy";
import { CreatePaymentUseCase } from "./application/use-cases/create-payment.use-case";
import { CancelPaymentUseCase } from "./application/use-cases/cancel-payment.use-case";
import {
  PaymentCursor,
  ReadPaymentsUseCase,
} from "./application/use-cases/read-payments.use-case";
import {
  PaymentsController,
  PayosWebhookController,
} from "./presentation/http/payments.controller";
@Module({
  imports: [
    DatabaseModule,
    IdempotencyModule,
    IdentityModule,
    CreditModule,
    AuditModule,
    ApplicationEventsModule,
  ],
  controllers: [
    PaymentsController,
    PayosWebhookController,
    AdminPaymentsController,
  ],
  providers: [
    AdminPaymentsReader,
    {
      provide: PaymentReconciliationReader,
      inject: [TransactionRunner, PayosTransport],
      useFactory: (runner: TransactionRunner, transport: PayosTransport) =>
        new PaymentReconciliationReader(runner, transport),
    },
    PayosTransport,
    PaymentCreationPolicy,
    PaymentCheckoutWorker,
    PaymentReceiptsService,
    CreatePaymentUseCase,
    CancelPaymentUseCase,
    ReadPaymentsUseCase,
    {
      provide: PaymentCursor,
      inject: [IdentityConfig],
      useFactory: (config: IdentityConfig) =>
        new PaymentCursor(`payments:${config.jwtKey}`),
    },
  ],
})
export class PaymentsModule {}
