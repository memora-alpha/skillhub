import type { PaymentCreateSnapshot } from "./payment-create-state";

export function resumesPayment(state: PaymentCreateSnapshot) {
  return (
    !state.canStartNext &&
    (state.stage === "unknown" ||
      !!state.paymentId ||
      !!state.policy?.existingPaymentId)
  );
}
type ReadSnapshot = {
  id?: string;
  status?: string;
  denied?: boolean;
  stale?: boolean;
};
// UI observation cadence only: no provider SLA, expiry decision or mutation retry.
// At most 120 GETs per focused foreground observation window, serialized.
export function startPaymentReadLoop(options: {
  current: () => boolean;
  snapshot: () => ReadSnapshot;
  read: () => Promise<unknown>;
  maxReads?: number;
  onStop?: () => void;
  schedule?: (work: () => void, delay: number) => () => void;
}) {
  const schedule =
    options.schedule ??
    ((work, delay) => {
      const timer = setTimeout(work, delay);
      return () => clearTimeout(timer);
    });
  const identity = options.snapshot().id;
  let active = true,
    reads = 0,
    errors = 0,
    cancel: (() => void) | undefined;
  const stop = () => {
    if (!active) return;
    active = false;
    cancel?.();
    cancel = undefined;
    options.onStop?.();
  };
  const eligible = () => {
    const s = options.snapshot();
    return (
      options.current() &&
      !!s.id &&
      s.id === identity &&
      !s.denied &&
      !["PAID", "FAILED", "EXPIRED", "REFUNDED"].includes(s.status ?? "")
    );
  };
  const plan = () => {
    if (!active) return;
    if (!eligible() || reads >= (options.maxReads ?? 120)) {
      stop();
      return;
    }
    const slow = ["REVIEW", "UNKNOWN"].includes(
      options.snapshot().status ?? "",
    );
    const delay = errors
      ? Math.min(30000, 5000 * 2 ** Math.min(errors, 3))
      : slow
        ? 30000
        : 5000;
    cancel = schedule(() => {
      cancel?.();
      cancel = undefined;
      void tick();
    }, delay);
  };
  const tick = async () => {
    if (!active) return;
    if (!eligible()) {
      stop();
      return;
    }
    reads++;
    try {
      await options.read();
      errors = options.snapshot().stale ? errors + 1 : 0;
    } catch {
      errors++;
    } finally {
      plan();
    }
  };
  plan();
  return stop;
}
