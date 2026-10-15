import { formatCredit } from "../../domain/money";
import type { LedgerEntry, LedgerEntryView } from "../contracts/wallet";

export function ledgerEntryView(row: LedgerEntry): LedgerEntryView {
  return {
    id: row.id,
    operationId: row.operationId,
    type: row.type,
    amount: formatCredit(row.amount),
    availableDelta: formatCredit(row.availableDelta),
    heldDelta: formatCredit(row.heldDelta),
    availableAfter: formatCredit(row.availableAfter),
    heldAfter: formatCredit(row.heldAfter),
    status: row.status,
    referenceType: row.referenceType,
    referenceId: row.referenceId,
    reversesTransactionId: row.reversesTransactionId,
    createdAt: row.createdAt,
  };
}
