import { IdentityTx } from "../../../../shared/database/identity-transactions";
import { AuditLog } from "../../../../generated/prisma/client";
import { SecurityEvent } from "../../application/contracts/security-event";
export abstract class AuditRepository {
  abstract append(tx: IdentityTx, data: SecurityEvent): Promise<AuditLog>;
}
