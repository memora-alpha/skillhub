import { Injectable } from "@nestjs/common";
import type { TransactionContext } from "../../../infrastructure/database/transaction-context";
import { validateAuditInput } from "../domain/audit-action.catalog";
import { AuditRepository } from "../infrastructure/audit.repository";
import type { AuditInput } from "./audit.types";

@Injectable()
export class AuditWriter {
  constructor(private readonly repository: AuditRepository) {}

  validate(input: AuditInput): AuditInput {
    return validateAuditInput(input);
  }

  async append(
    tx: TransactionContext,
    input: AuditInput,
  ): Promise<{ auditId: string }> {
    return this.repository.append(tx, this.validate(input));
  }
}
