import {
  creditAmount,
  vndAmount,
} from "../../src/features/wallet/utils/amount";
import type { PaymentModelTarget } from "./wallet-model-types";

// Independent US3 fixtures. No US2 intent, Payment HTTP or provider data.
export const paymentTarget: PaymentModelTarget = {
  scope: { ownerId: "synthetic-owner-a", generation: 1 },
  paymentId: "synthetic-payment-observation-a",
  amountVnd: vndAmount("123000"),
  credit: creditAmount("123.00"),
};
export const paymentReceipt = (state = "PENDING", target = paymentTarget) => ({
  scope: { ...target.scope },
  payment: {
    paymentId: target.paymentId,
    state,
    amountVnd: target.amountVnd,
    credit: target.credit,
  },
});
export function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
