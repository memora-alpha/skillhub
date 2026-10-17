import type { WalletRuntime } from "./wallet-runtime";
import { createPaymentPreparation } from "../utils/payment-intent";

// One session-owned model, no HTTP client or lifecycle dispatch callback.
export function attachPaymentPreparation(runtime: WalletRuntime) {
  const existing = runtime.sessionData.get("payment-preparation");
  if (existing) return existing as PaymentPreparationSession;
  const model = createPaymentPreparation({
    scope: runtime.scope,
    isCurrent: runtime.isCurrent,
  });
  const session = {
    runtime,
    model,
    activate: () => {
      model.activate();
      runtime.sessionData.set("payment-preparation", session);
      runtime.addCleanup(model.dispose);
    },
  };
  runtime.sessionData.set("payment-preparation", session);
  runtime.addCleanup(model.dispose);
  return session;
}
export type PaymentPreparationSession = {
  runtime: WalletRuntime;
  model: ReturnType<typeof createPaymentPreparation>;
  activate: () => void;
};
