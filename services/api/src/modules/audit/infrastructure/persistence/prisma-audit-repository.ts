import { IdentityTx } from "../../../../shared/database/identity-transactions";
import { AuditLog } from "../../../../generated/prisma/client";
import { SecurityEvent } from "../../application/contracts/security-event";
import { Injectable } from "@nestjs/common";
import { AuditRepository } from "../../application/ports/audit-repository";
@Injectable()
export class PrismaAuditRepository extends AuditRepository {
  append(tx: IdentityTx, data: SecurityEvent): Promise<AuditLog> {
    return tx.auditLog.create({ data });
  }
}
