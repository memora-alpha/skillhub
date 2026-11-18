import { Module } from "@nestjs/common";
import { AuditWriter } from "./application/services/audit-writer";
import { AuditRepository } from "./infrastructure/persistence/audit.repository";
import { DatabaseModule } from "../../infrastructure/database/database.module";
import { IdentityModule } from "../identity.module";
import { AuditReader } from "./application/services/audit-reader";
import { AuditController } from "./presentation/http/audit.controller";

@Module({
  imports: [DatabaseModule, IdentityModule],
  controllers: [AuditController],
  providers: [AuditRepository, AuditWriter, AuditReader],
  exports: [AuditWriter, AuditReader],
})
export class AuditModule {}
