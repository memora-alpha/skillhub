import { AppError } from "../../src/lib/http/errors";
import {
  creditAmount,
  vndAmount,
} from "../../src/features/wallet/utils/amount";
import { paymentState } from "../../src/features/wallet/utils/payment-outcome";
import type { PaymentObservationModel } from "../../src/features/wallet/types/payment";
import type { WalletScope } from "../../src/features/wallet/types/wallet";
import type { PaymentModelTarget } from "./wallet-model-types";
export function validPaymentModelTarget(
  target: unknown,
  scope: WalletScope,
): target is PaymentModelTarget {
  if (!target || typeof target !== "object") return false;
  const value = target as PaymentModelTarget;
  try {
    return (
      typeof value.paymentId === "string" &&
      !!value.paymentId.trim() &&
      value.scope?.ownerId === scope.ownerId &&
      value.scope?.generation === scope.generation &&
      !!scope.ownerId &&
      Number.isSafeInteger(scope.generation) &&
      scope.generation >= 0 &&
      vndAmount(value.amountVnd) === value.amountVnd &&
      creditAmount(value.credit) === value.credit
    );
  } catch {
    return false;
  }
}
export function observePaymentModel(
  input: unknown,
  target: PaymentModelTarget,
): PaymentObservationModel {
  // An inert, owner-associated observation, NOT a proposed public Payment schema.
  if (!input || typeof input !== "object") throw new AppError("protocol");
  const receipt = input as {
    scope?: WalletScope;
    payment?: Record<string, unknown>;
  };
  const payment = receipt.payment;
  if (
    !validPaymentModelTarget(target, target.scope) ||
    !payment ||
    receipt.scope?.ownerId !== target.scope.ownerId ||
    receipt.scope?.generation !== target.scope.generation ||
    payment.paymentId !== target.paymentId ||
    payment.amountVnd !== target.amountVnd ||
    payment.credit !== target.credit ||
    typeof payment.state !== "string"
  )
    throw new AppError("protocol");
  const state = paymentState(payment.state);
  return Object.freeze({
    paymentId: target.paymentId,
    state,
    amountVnd: vndAmount(payment.amountVnd),
    credit: creditAmount(payment.credit),
  });
}
export function reconcilePaymentModel(
  previous: PaymentObservationModel | undefined,
  incoming: PaymentObservationModel,
) {
  if (!previous) return { data: incoming, conflict: false };
  const conflict =
    previous.paymentId !== incoming.paymentId ||
    previous.state !== incoming.state ||
    previous.amountVnd !== incoming.amountVnd ||
    previous.credit !== incoming.credit;
  // No server freshness/order contract: neither enum rank nor client time wins.
  return { data: previous, conflict };
}
