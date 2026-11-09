import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../infrastructure/database/database.module";
import { IdempotencyModule } from "../../infrastructure/idempotency/idempotency.module";
import { AuditModule } from "../audit/audit.module";
import { CreditModule } from "../credit/credit.module";
import { IdentityModule } from "../identity.module";
import { ReputationModule } from "../reputation/reputation.module";
import { AdminQaAdjustmentsController } from "./admin-qa-adjustments.controller";
import { AdminQaAdjustmentsService } from "./admin-qa-adjustments.service";

@Module({
  imports: [
    AuditModule,
    CreditModule,
    DatabaseModule,
    IdentityModule,
    IdempotencyModule,
    ReputationModule,
  ],
  controllers: [AdminQaAdjustmentsController],
  providers: [AdminQaAdjustmentsService],
})
export class AdminQaAdjustmentsModule {}
