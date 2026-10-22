import type { PaymentCreateSnapshot } from "./payment-create-state";
import { isTerminalPaymentStatus } from "./payment-outcome";

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
// Active checkout: 2s fallback / 300 reads, or a 30s safety read / 20 reads with
// SSE connected (10 minutes of scheduled waits). REVIEW/UNKNOWN: 30s / 120 reads.
export function startPaymentReadLoop(options: {
  current: () => boolean;
  snapshot: () => ReadSnapshot;
  read: () => Promise<unknown>;
  realtime?: () => boolean;
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
      !isTerminalPaymentStatus(s.status ?? "")
    );
  };
  const plan = () => {
    if (!active) return;
    const slow = ["REVIEW", "UNKNOWN"].includes(
      options.snapshot().status ?? "",
    );
    const limit = slow ? 120 : options.realtime?.() ? 20 : 300;
    if (!eligible() || reads >= (options.maxReads ?? limit)) {
      stop();
      return;
    }
    const delay = errors
      ? Math.min(30000, 5000 * 2 ** Math.min(errors, 3))
      : slow || options.realtime?.()
        ? 30000
        : 2000;
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
