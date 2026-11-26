import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../infrastructure/database/database.module";
import { IdempotencyModule } from "../../infrastructure/idempotency/idempotency.module";
import { AuditModule } from "../audit/audit.module";
import { CreditModule } from "../credit/credit.module";
import { IdentityModule } from "../identity.module";
import { SystemConfigurationModule } from "../system-configuration/system-configuration.module";
import { SubscriptionEntitlementsReader } from "./application/services/subscription-entitlements.reader";
import { SubscriptionPlansService } from "./application/services/subscription-plans.service";
import { SubscriptionRenewalService } from "./application/services/subscription-renewal.service";
import { SubscriptionsService } from "./application/services/subscriptions.service";
import { SubscriptionRenewalWorker } from "./infrastructure/jobs/subscription-renewal.worker";
import { AdminSubscriptionsController } from "./presentation/http/admin-subscriptions.controller";
import { SubscriptionsController } from "./presentation/http/subscriptions.controller";

/** Spec 021: Credit-paid plans. Other modules read plans only through the entitlements reader. */
@Module({
  imports: [
    DatabaseModule,
    IdentityModule,
    AuditModule,
    CreditModule,
    IdempotencyModule,
    SystemConfigurationModule,
  ],
  controllers: [SubscriptionsController, AdminSubscriptionsController],
  providers: [
    SubscriptionPlansService,
    SubscriptionsService,
    SubscriptionEntitlementsReader,
    SubscriptionRenewalService,
    SubscriptionRenewalWorker,
  ],
  exports: [SubscriptionEntitlementsReader],
})
export class SubscriptionsModule {}
