import { z } from "zod";
import { AppError } from "@/lib/http/errors";
import { isRecord } from "@/lib/http/response";
import { creditAmount, creditDelta } from "../utils/amount";
import {
  transactionTypes,
  referenceTypes,
  type HistoryFilters,
  type Transaction,
} from "../types/transaction";

export const validTransactionId = (id: unknown): id is string =>
  z.uuid().safeParse(id).success;
export function parseHistoryFilters(value: HistoryFilters): HistoryFilters {
  const parsed = z
    .object({
      type: z.enum(transactionTypes).optional(),
      referenceType: z.enum(referenceTypes).optional(),
    })
    .strict()
    .safeParse(value);
  if (!parsed.success) throw new AppError("protocol");
  return parsed.data;
}
export function parseTransaction(value: unknown): Transaction {
  if (
    !isRecord(value) ||
    !validTransactionId(value.id) ||
    !validTransactionId(value.operationId) ||
    !(
      value.reversesTransactionId === null ||
      validTransactionId(value.reversesTransactionId)
    ) ||
    ![value.type, value.status, value.referenceType].every(
      (v) => typeof v === "string" && v.length > 0,
    ) ||
    typeof value.referenceId !== "string" ||
    typeof value.createdAt !== "string" ||
    !z.iso.datetime({ offset: true }).safeParse(value.createdAt).success
  )
    throw new AppError("protocol");
  try {
    const amount = creditAmount(value.amount);
    if (amount === "0.00") throw new AppError("protocol");
    return {
      id: value.id,
      operationId: value.operationId,
      type: value.type as string,
      status: value.status as string,
      amount,
      availableDelta: creditDelta(value.availableDelta),
      heldDelta: creditDelta(value.heldDelta),
      availableAfter: creditAmount(value.availableAfter),
      heldAfter: creditAmount(value.heldAfter),
      referenceType: value.referenceType as string,
      referenceId: value.referenceId,
      reversesTransactionId: value.reversesTransactionId as string | null,
      createdAt: value.createdAt,
    };
  } catch {
    throw new AppError("protocol");
  }
}
