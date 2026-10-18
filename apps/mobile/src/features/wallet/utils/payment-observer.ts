import { AppError } from "@/lib/http/errors";
import type { WalletScope } from "../types/wallet";
import type {
  PaymentModelTarget,
  PaymentModelReader,
  PaymentObservationRead,
} from "../types/payment";
import {
  observePaymentModel,
  reconcilePaymentModel,
  validPaymentModelTarget,
} from "./payment-outcome";
import { paymentModelStore } from "./payment-model-store";

const unavailable: PaymentObservationRead = Object.freeze({
  status: "unavailable",
  stale: false,
});
const ended: PaymentObservationRead = Object.freeze({
  status: "session-ended",
  stale: false,
});
export function createPaymentObserver({
  scope,
  target,
  current,
  read,
}: {
  scope: WalletScope;
  target?: unknown;
  current: () => boolean;
  read?: PaymentModelReader;
}) {
  const identity: PaymentModelTarget | undefined = validPaymentModelTarget(
    target,
    scope,
  )
    ? Object.freeze({ ...target, scope: Object.freeze({ ...scope }) })
    : undefined;
  const store = paymentModelStore<PaymentObservationRead>(unavailable);
  let active = true,
    focused = true,
    ticket = 0;
  let denial: "denied" | "not-found" | undefined;
  let pending:
    | {
        controller: AbortController;
        promise: Promise<void>;
        finish: () => void;
      }
    | undefined;
  const live = () => active && current();
  const canCheck = () => live() && focused && !!identity && !!read;
  const invalidate = () => {
    ticket++;
    const old = pending;
    pending = undefined;
    old?.controller.abort();
    old?.finish();
  };
  function check(): Promise<void> {
    if (!canCheck()) return Promise.resolve();
    if (pending) return pending.promise;
    let finish!: () => void;
    const promise = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const controller = new AbortController(),
      started = ++ticket;
    pending = { controller, promise, finish };
    const previous = store.getSnapshot();
    store.publish({
      ...previous,
      status: previous.data ? "refreshing" : "loading",
      stale: !!previous.data,
    });
    const valid = () =>
      canCheck() && ticket === started && !controller.signal.aborted;
    void (async () => {
      try {
        if (!valid()) return;
        const response = await read!(identity!, controller.signal);
        if (!valid()) return;
        const incoming = observePaymentModel(response, identity!);
        const result = reconcilePaymentModel(
          store.getSnapshot().data,
          incoming,
        );
        denial = undefined;
        store.publish({
          status: result.conflict ? "refresh-error" : "ready",
          data: result.data,
          stale: result.conflict,
          ...(result.conflict ? { issue: "conflict" as const } : {}),
        });
      } catch (error) {
        if (!valid()) return;
        if (error instanceof AppError && [403, 404].includes(error.status)) {
          denial = error.status === 403 ? "denied" : "not-found";
          store.publish({ status: denial, stale: false });
        } else if (denial) store.publish({ status: denial, stale: false });
        else {
          const data = store.getSnapshot().data;
          store.publish({
            status: data ? "refresh-error" : "error",
            data,
            stale: !!data,
          });
        }
      } finally {
        if (pending?.controller === controller) pending = undefined;
        finish();
      }
    })();
    return promise;
  }
  return {
    getSnapshot: () => (live() ? store.getSnapshot() : ended),
    subscribe: store.subscribe,
    canCheck,
    check,
    pause: () => {
      focused = false;
      invalidate();
      if (!live()) return;
      const data = store.getSnapshot().data;
      store.publish(
        denial
          ? { status: denial, stale: false }
          : data
            ? { status: "ready", data, stale: true }
            : unavailable,
      );
    },
    resume: () => {
      focused = true;
    },
    dispose: () => {
      active = false;
      invalidate();
      denial = undefined;
      store.publish(ended);
    },
    activate: () => {
      if (!active && current()) {
        active = true;
        focused = true;
        store.publish(unavailable);
      }
    },
  };
}
export type PaymentObserver = ReturnType<typeof createPaymentObserver>;
// Actual-contract read path is independent of the inert preparation reader.
export {
  paymentReadOptions,
  projectPaymentRead,
  pausePaymentRead,
} from "./payment-read-query";
