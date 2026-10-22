import { AppError } from "@/lib/http/errors";
import { validPaymentId } from "../schemas/payment-contracts";
import type { PaymentProjection } from "../types/payment";
import type { WalletScope } from "../types/wallet";

export type PaymentReadTarget = Readonly<{
  scope: WalletScope;
  paymentId: string;
}>;
export type PaymentLiveObservation = Readonly<{
  target: PaymentReadTarget;
  data?: PaymentProjection;
  stale: boolean;
  issue?: "conflict";
  suppressedVersion?: number;
  detached?: boolean;
}>;
type ObservationEvent = Readonly<{
  scope: WalletScope;
  paymentId: string;
  ticket: number;
  currentTicket: number;
  data: PaymentProjection;
}>;
const sameScope = (a: WalletScope, b: WalletScope) =>
  a.ownerId === b.ownerId && a.generation === b.generation;

export function createPaymentObservation(
  target: PaymentReadTarget,
): PaymentLiveObservation {
  if (
    !validPaymentId(target.paymentId) ||
    !target.scope.ownerId ||
    !Number.isSafeInteger(target.scope.generation) ||
    target.scope.generation < 0
  )
    throw new AppError("protocol");
  return Object.freeze({
    target: Object.freeze({
      paymentId: target.paymentId,
      scope: Object.freeze({ ...target.scope }),
    }),
    stale: false,
  });
}

const immutableFields = [
  "id",
  "gateway",
  "paymentAmountVnd",
  "creditAmount",
  "currency",
  "conversionRateVndPerCredit",
  "createdAt",
  "expiresAt",
] as const;
function sameCheckout(
  a: PaymentProjection["checkout"],
  b: PaymentProjection["checkout"],
) {
  return (
    a === b ||
    (!!a &&
      !!b &&
      a.providerStatus === b.providerStatus &&
      a.paymentLinkId === b.paymentLinkId &&
      a.orderCode === b.orderCode &&
      a.qrCode === b.qrCode)
  );
}

// Pure acceptance only. The future reader owns current scope/ticket capture,
// cancellation and denial eviction. No transport, clock, ledger or US2 intent.
export function reducePaymentObservation(
  previous: PaymentLiveObservation,
  event: ObservationEvent,
): PaymentLiveObservation {
  if (
    !sameScope(previous.target.scope, event.scope) ||
    previous.target.paymentId !== event.paymentId ||
    !Number.isSafeInteger(event.ticket) ||
    event.ticket < 1 ||
    event.ticket !== event.currentTicket
  )
    return previous;
  const incoming = event.data,
    old = previous.data;
  const conflict = () =>
    Object.freeze({ ...previous, stale: true, issue: "conflict" as const });
  if (incoming.id !== previous.target.paymentId) return conflict();
  if (old && incoming.version < old.version) return previous;
  if (old && immutableFields.some((key) => old[key] !== incoming[key]))
    return conflict();
  if (!old || incoming.version > old.version)
    return Object.freeze({
      target: previous.target,
      data: incoming,
      stale: false,
      ...(incoming.checkout === null
        ? { suppressedVersion: incoming.version }
        : {}),
    });

  return acceptEqualVersion(previous, old, incoming);
}

function acceptedCheckout(
  previous: PaymentLiveObservation,
  old: PaymentProjection,
  incoming: PaymentProjection,
  suppress: boolean,
) {
  if (previous.detached && !suppress)
    return { ...old, checkout: incoming.checkout };
  if (suppress && old.checkout !== null)
    return Object.freeze({ ...old, checkout: null });
  return old;
}

function acceptEqualVersion(
  previous: PaymentLiveObservation,
  old: PaymentProjection,
  incoming: PaymentProjection,
): PaymentLiveObservation {
  // Server read-time expiry can hide QR without a persisted version increment.
  // Latch null for this session/payment/version; no local timer can reset it.
  const suppress =
    previous.suppressedVersion === old.version || incoming.checkout === null;
  const accepted = acceptedCheckout(previous, old, incoming, suppress);
  const equal =
    old.status === incoming.status &&
    old.paidAt === incoming.paidAt &&
    (suppress ||
      previous.detached ||
      sameCheckout(old.checkout, incoming.checkout));
  // Read-time operational metadata is not versioned financial state. It can
  // change/clear while an equal-version QR suppression latch must remain set.
  const data = Object.freeze({
    ...accepted,
    recoveryRequired: incoming.recoveryRequired,
    recoveryReason: incoming.recoveryReason,
  });
  return Object.freeze({
    target: previous.target,
    data,
    stale: !equal,
    ...(!equal ? { issue: "conflict" as const } : {}),
    ...(suppress ? { suppressedVersion: old.version } : {}),
  });
}

export function detachPaymentQr(
  previous: PaymentLiveObservation,
): PaymentLiveObservation {
  return Object.freeze({
    ...previous,
    detached: true,
    ...(previous.data
      ? { data: Object.freeze({ ...previous.data, checkout: null }) }
      : {}),
    stale: true,
  });
}
