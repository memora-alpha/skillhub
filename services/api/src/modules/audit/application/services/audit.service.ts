import { Injectable } from "@nestjs/common";
import { IdentityTx } from "../../../../shared/database/identity-transactions";
import { SecurityEvent } from "../contracts/security-event";
import { AuditRepository } from "../ports/audit-repository";
@Injectable()
export class AuditService {
  constructor(private readonly repository: AuditRepository) {}
  append(tx: IdentityTx, data: SecurityEvent) {
    return this.repository.append(tx, data);
  }
}
