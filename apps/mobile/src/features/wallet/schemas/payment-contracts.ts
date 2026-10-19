import { z } from "zod";
import { AppError } from "@/lib/http/errors";
import { isRecord } from "@/lib/http/response";
import { creditAmount, vndAmount } from "../utils/amount";
import type {
  PaymentCheckout,
  PaymentProjection,
  PaymentCreationPolicy,
} from "../types/payment";

export const validPaymentId = (value: unknown): value is string =>
  z.uuid().safeParse(value).success;
const isoDate = z.iso.datetime({ offset: true });
const text = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;
const date = (value: unknown): value is string =>
  typeof value === "string" && isoDate.safeParse(value).success;
const positiveInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value > 0;

function parseCheckout(value: unknown, status: string): PaymentCheckout | null {
  if (value === null) return null;
  if (
    status !== "PENDING" ||
    !isRecord(value) ||
    value.providerStatus !== "PENDING" ||
    !text(value.paymentLinkId) ||
    !text(value.orderCode) ||
    value.orderCode.match(/^\d+$/)?.[0] !== value.orderCode ||
    !text(value.qrCode)
  )
    throw new AppError("protocol");
  return Object.freeze({
    providerStatus: "PENDING",
    paymentLinkId: value.paymentLinkId,
    orderCode: value.orderCode,
    qrCode: value.qrCode,
  });
}

export function parsePayment(
  value: unknown,
  expectedId?: string,
): PaymentProjection {
  if (
    !isRecord(value) ||
    !validPaymentId(value.id) ||
    (expectedId !== undefined &&
      (!validPaymentId(expectedId) || value.id !== expectedId)) ||
    !text(value.gateway) ||
    !text(value.status) ||
    value.currency !== "VND" ||
    !positiveInteger(value.version) ||
    typeof value.recoveryRequired !== "boolean" ||
    !(value.recoveryReason === null || text(value.recoveryReason)) ||
    value.recoveryRequired !== (value.recoveryReason !== null) ||
    !positiveInteger(value.conversionRateVndPerCredit) ||
    value.conversionRateVndPerCredit !== 1000 ||
    !date(value.createdAt) ||
    !(value.expiresAt === null || date(value.expiresAt)) ||
    !(value.paidAt === null || date(value.paidAt))
  )
    throw new AppError("protocol");
  try {
    const amount = vndAmount(value.paymentAmountVnd),
      credit = creditAmount(value.creditAmount);
    // Exact quote validation, never client crediting or settlement. Read legacy
    // amounts without applying today's create-input bounds/step to history.
    if (
      BigInt(credit.replace(".", "")) *
        BigInt(value.conversionRateVndPerCredit) !==
      BigInt(amount) * 100n
    )
      throw new AppError("protocol");
    return Object.freeze({
      id: value.id,
      gateway: value.gateway,
      status: value.status,
      paymentAmountVnd: amount,
      currency: "VND",
      creditAmount: credit,
      conversionRateVndPerCredit: value.conversionRateVndPerCredit,
      createdAt: value.createdAt,
      expiresAt: value.expiresAt,
      paidAt: value.paidAt,
      version: value.version,
      recoveryRequired: value.recoveryRequired,
      recoveryReason: value.recoveryReason,
      checkout: parseCheckout(value.checkout, value.status),
    });
  } catch {
    throw new AppError("protocol");
  }
}

export function parseCreationPolicy(value: unknown): PaymentCreationPolicy {
  if (
    !isRecord(value) ||
    typeof value.canCreate !== "boolean" ||
    !(value.reasonCode === null || text(value.reasonCode)) ||
    !(
      value.existingPaymentId === null ||
      validPaymentId(value.existingPaymentId)
    )
  )
    throw new AppError("protocol");
  const own =
    value.reasonCode === "PAYMENT_UNRESOLVED" ||
    value.reasonCode === "PAYMENT_RECONCILIATION_REQUIRED";
  if (
    value.canCreate
      ? value.reasonCode !== null || value.existingPaymentId !== null
      : value.reasonCode === null ||
        (own
          ? value.existingPaymentId === null
          : value.existingPaymentId !== null)
  )
    throw new AppError("protocol");
  return Object.freeze({
    canCreate: value.canCreate,
    reasonCode: value.reasonCode,
    existingPaymentId: value.existingPaymentId,
  });
}
