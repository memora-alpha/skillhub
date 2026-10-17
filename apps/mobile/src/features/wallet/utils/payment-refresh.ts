import type {
  PaymentObservationModel,
  PaymentRefreshSnapshot,
  RelatedRead,
} from "../types/payment";
import { paymentModelStore } from "./payment-model-store";

type Resource = "wallet" | "history";
type Read = (signal: AbortSignal) => Promise<unknown>;
const unavailable: RelatedRead = Object.freeze({
  status: "unavailable",
  stale: false,
});
const ended: PaymentRefreshSnapshot = Object.freeze({
  wallet: unavailable,
  history: unavailable,
});
export function createPaymentRefresh({
  payment,
  current,
  reads,
}: {
  payment: PaymentObservationModel;
  current: () => boolean;
  reads?: Readonly<Record<Resource, Read>>;
}) {
  const observed = Object.isFrozen(payment)
    ? payment
    : Object.freeze({ ...payment });
  const eligible = observed.state === "PAID" && !!reads;
  const idle: RelatedRead = eligible
    ? Object.freeze({ status: "idle", stale: false })
    : unavailable;
  const store = paymentModelStore<PaymentRefreshSnapshot>({
    payment: observed,
    wallet: idle,
    history: idle,
  });
  let active = true;
  const pending = new Map<
    Resource,
    { controller: AbortController; promise: Promise<void>; finish: () => void }
  >();
  const live = () => active && current();
  const update = (name: Resource, result: RelatedRead) => {
    if (live())
      store.publish({ ...store.getSnapshot(), [name]: Object.freeze(result) });
  };
  function run(name: Resource): Promise<void> {
    if (!eligible || !live()) return Promise.resolve();
    const old = pending.get(name);
    if (old) return old.promise;
    const prior = store.getSnapshot()[name];
    const stale = prior.stale || prior.status === "success";
    let finish!: () => void;
    const promise = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const controller = new AbortController();
    pending.set(name, { controller, promise, finish });
    update(name, { status: "loading", stale });
    const valid = () =>
      live() &&
      !controller.signal.aborted &&
      pending.get(name)?.controller === controller;
    void (async () => {
      try {
        if (!valid()) return;
        await reads![name](controller.signal);
        if (valid()) update(name, { status: "success", stale: false });
      } catch {
        if (valid()) update(name, { status: "error", stale });
      } finally {
        if (pending.get(name)?.controller === controller) pending.delete(name);
        finish();
      }
    })();
    return promise;
  }
  const pause = () => {
    for (const [name, work] of pending) {
      pending.delete(name);
      work.controller.abort();
      work.finish();
      update(name, { status: "idle", stale: store.getSnapshot()[name].stale });
    }
  };
  return {
    getSnapshot: () => (live() ? store.getSnapshot() : ended),
    subscribe: store.subscribe,
    refresh: (name?: Resource) =>
      name
        ? run(name)
        : Promise.allSettled([run("wallet"), run("history")]).then(() => {}),
    pause,
    dispose: () => {
      active = false;
      pause();
      store.publish(ended);
    },
    activate: () => {
      if (!active && current()) {
        active = true;
        store.publish({ payment: observed, wallet: idle, history: idle });
      }
    },
  };
}
export type PaymentRefresh = ReturnType<typeof createPaymentRefresh>;
