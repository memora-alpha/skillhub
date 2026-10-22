import { z } from "zod";
import { AppError } from "@/lib/http/errors";
import { isTerminalPaymentStatus } from "./payment-outcome";
import { validateContractTopUp } from "./topup-policy";
import type { PaymentProjection } from "../types/payment";

export type PaymentIdentity = Readonly<{
  ownerId: string;
  environment: string;
}>;
export type CreatePaymentBody = Readonly<{
  paymentAmountVnd: string;
  gateway: "PAYOS";
}>;
const schema = z
  .object({
    formatVersion: z.literal(1),
    ownerId: z.string().min(1).max(128),
    environment: z.url().max(512),
    key: z.string().regex(/^[\x21-\x7e]{1,128}$/),
    body: z
      .object({
        paymentAmountVnd: z.string().max(7),
        gateway: z.literal("PAYOS"),
      })
      .strict(),
    localIntentId: z.string().min(1).max(128),
    dispatchMarker: z.literal("MAY_HAVE_DISPATCHED"),
    paymentId: z.uuid().optional(),
  })
  .strict();
export type RecoveryRecord = Readonly<z.infer<typeof schema>>;
export function boundedJson(value: unknown) {
  const text = JSON.stringify(value);
  let bytes = 0;
  for (const char of text) {
    const point = char.codePointAt(0)!;
    bytes += point < 128 ? 1 : point < 2048 ? 2 : point < 65536 ? 3 : 4;
  }
  if (bytes >= 2048) throw new AppError("storage");
  return text;
}
export function parseRecoveryRecord(
  value: unknown,
  identity: PaymentIdentity,
): RecoveryRecord {
  try {
    boundedJson(value);
    const r = schema.parse(value);
    // Preserve recovery for requests dispatched under the prior BE minimum.
    validateContractTopUp(r.body.paymentAmountVnd);
    if (
      r.ownerId !== identity.ownerId ||
      r.environment !== identity.environment
    )
      throw Error();
    return Object.freeze({ ...r, body: Object.freeze({ ...r.body }) });
  } catch {
    throw new AppError("storage");
  }
}
export function makeRecoveryRecord(
  input: PaymentIdentity & {
    key: string;
    localIntentId: string;
    body: CreatePaymentBody;
    paymentId?: string;
  },
): RecoveryRecord {
  return parseRecoveryRecord(
    { ...input, formatVersion: 1, dispatchMarker: "MAY_HAVE_DISPATCHED" },
    input,
  );
}
export function sameRecoveryIntent(a: RecoveryRecord, b: RecoveryRecord) {
  return (
    a.ownerId === b.ownerId &&
    a.environment === b.environment &&
    a.key === b.key &&
    a.localIntentId === b.localIntentId &&
    a.body.gateway === b.body.gateway &&
    a.body.paymentAmountVnd === b.body.paymentAmountVnd
  );
}
export function correlationResolved(
  record: RecoveryRecord,
  payment: PaymentProjection,
) {
  return (
    record.paymentId === payment.id &&
    record.body.gateway === payment.gateway &&
    record.body.paymentAmountVnd === payment.paymentAmountVnd &&
    !payment.recoveryRequired &&
    payment.recoveryReason === null &&
    isTerminalPaymentStatus(payment.status)
  );
}
