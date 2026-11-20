import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../infrastructure/database/database.module";
import { IdempotencyModule } from "../../infrastructure/idempotency/idempotency.module";
import { AuditModule } from "../audit/audit.module";
import { CreditModule } from "../credit/credit.module";
import { IdentityModule } from "../identity.module";
import { SystemConfigurationModule } from "../system-configuration/system-configuration.module";
import { CatalogSyncService } from "./application/services/catalog-sync.service";
import { RedemptionService } from "./application/services/redemption.service";
import { RewardCatalogService } from "./application/services/reward-catalog.service";
import { VoucherSecretCipher } from "./application/services/voucher-secret.cipher";
import { VoucherProvider } from "./application/ports/voucher-provider";
import { RedemptionReconcileWorker } from "./infrastructure/jobs/redemption-reconcile.worker";
import { MockVoucherProvider } from "./infrastructure/providers/mock-voucher.provider";
import { AdminRewardsController } from "./presentation/http/admin-rewards.controller";
import { RewardsController } from "./presentation/http/rewards.controller";

@Module({
  imports: [
    DatabaseModule,
    IdentityModule,
    AuditModule,
    CreditModule,
    IdempotencyModule,
    SystemConfigurationModule,
  ],
  controllers: [RewardsController, AdminRewardsController],
  providers: [
    MockVoucherProvider,
    // The Got It adapter joins this factory in phase 7 (specs/018 T060).
    { provide: VoucherProvider, useExisting: MockVoucherProvider },
    VoucherSecretCipher,
    CatalogSyncService,
    RewardCatalogService,
    RedemptionService,
    RedemptionReconcileWorker,
  ],
  exports: [RedemptionService],
})
export class RewardsModule {}
