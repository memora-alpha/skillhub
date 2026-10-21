import { Injectable } from "@nestjs/common";
import type { CreditAdjustmentPort } from "../../application/ports/credit.ports";
import { CreditOperationsService } from "../../application/services/credit-operations.service";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";

@Injectable()
export class PrismaCreditAdjustmentAdapter implements CreditAdjustmentPort {
  constructor(private readonly operations: CreditOperationsService) {}

  adjust(
    tx: TransactionContext,
    input: Parameters<CreditAdjustmentPort["adjust"]>[1],
  ) {
    return this.operations.adjustAvailable(tx, {
      ...input,
      referenceId: input.referenceId,
    });
  }

  reverse(
    tx: TransactionContext,
    input: Parameters<CreditAdjustmentPort["reverse"]>[1],
  ) {
    return this.operations.reversePathAvailable(tx, {
      operationId: input.operationId,
      referenceId: input.referenceId,
      sourceReferenceId: input.sourceReferenceId,
      actorId: input.actorId,
      reason: input.reason,
      idempotencyKey: input.idempotencyKey,
    });
  }
}
