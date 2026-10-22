import type { PaymentLiveObservation } from "./payment-observation";
import type { WalletScope } from "../types/wallet";

// Ephemeral presentation, not a provider DTO, financial result or persisted record.
export type QrPresentation = Readonly<{
  stage: "preparing" | "unavailable" | "ready-model" | "render-error";
  paymentId?: string;
  raw?: string;
}>;

export function paymentQrFromObservation(
  observation: PaymentLiveObservation | undefined,
  currentScope: WalletScope,
  current = true,
): QrPresentation {
  if (
    !current ||
    !observation ||
    observation.target.scope.ownerId !== currentScope.ownerId ||
    observation.target.scope.generation !== currentScope.generation
  )
    return { stage: "unavailable" };
  const paymentId = observation.target.paymentId;
  const data = observation.data;
  if (!data) return { stage: "preparing", paymentId };
  if (
    observation.stale ||
    observation.issue ||
    data.id !== paymentId ||
    data.status !== "PENDING" ||
    data.recoveryRequired ||
    !data.checkout ||
    (observation.suppressedVersion ?? 0) >= data.version
  )
    return { stage: "unavailable", paymentId };
  return { stage: "ready-model", paymentId, raw: data.checkout.qrCode };
}
