import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../infrastructure/database/database.module";
import { IdempotencyModule } from "../../infrastructure/idempotency/idempotency.module";
import { IdentityModule } from "../identity.module";
import { CreditModule } from "../credit/credit.module";
import { AuditModule } from "../audit/audit.module";
import { ApplicationEventsModule } from "../application-events/application-events.module";
import { IdentityConfig } from "../../configs/identity.config";
import { PayosTransport } from "./infrastructure/payos-transport";
import { PaymentCheckoutWorker } from "./application/services/payment-checkout.worker";
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
  controllers: [PaymentsController, PayosWebhookController],
  providers: [
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
