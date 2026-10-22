import type { WalletRuntime } from "./wallet-runtime";
import { createPaymentCoordinator } from "../utils/payment-create-coordinator";
import type { PaymentCoordinatorOptions } from "../utils/payment-create-state";

// One durable coordinator per current owner/session/environment, across callers.
export function attachPaymentCreate(
  runtime: WalletRuntime,
  options: Omit<PaymentCoordinatorOptions, "current" | "scope">,
) {
  const key = `payment-create:${options.identity.environment}`;
  const existing = runtime.sessionData.get(key) as
    ReturnType<typeof createPaymentCoordinator> | undefined;
  if (existing) return existing;
  const model = createPaymentCoordinator({
    ...options,
    scope: runtime.scope,
    current: runtime.isCurrent,
  });
  runtime.sessionData.set(key, model);
  runtime.addCleanup(model.dispose);
  return model;
}

// Stack routes share a coordinator. A late blur must not cancel its new owner.
export function focusPaymentCreate(
  runtime: WalletRuntime,
  environment: string,
  model: Pick<
    ReturnType<typeof createPaymentCoordinator>,
    "activate" | "pause" | "dispose"
  >,
) {
  const key = `payment-create:${environment}`;
  const focusKey = `${key}:focus`;
  const token = {};
  model.activate();
  runtime.sessionData.set(key, model);
  runtime.sessionData.set(focusKey, token);
  runtime.addCleanup(model.dispose);
  const current = () =>
    runtime.isCurrent() && runtime.sessionData.get(focusKey) === token;
  return {
    current,
    release: () => {
      if (!current()) return;
      runtime.sessionData.delete(focusKey);
      model.pause();
    },
  };
}
