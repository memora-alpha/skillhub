import { Module } from "@nestjs/common";
import { AuditWriter } from "./application/services/audit-writer";
import { AuditRepository } from "./infrastructure/persistence/audit.repository";

@Module({ providers: [AuditRepository, AuditWriter], exports: [AuditWriter] })
export class AuditModule {}
