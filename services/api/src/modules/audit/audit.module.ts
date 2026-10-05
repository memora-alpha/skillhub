import { Module } from "@nestjs/common";
import { AuditWriter } from "./application/audit-writer";
import { AuditRepository } from "./infrastructure/audit.repository";

@Module({ providers: [AuditRepository, AuditWriter], exports: [AuditWriter] })
export class AuditModule {}
