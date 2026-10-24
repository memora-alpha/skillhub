import type { createConnectionStore } from "./connection-store";

// Only one delayed probe at a time; the store owns the in-flight retry lock.
export function startConnectionRecovery(
  store: Pick<
    ReturnType<typeof createConnectionStore>,
    "getSnapshot" | "subscribe"
  >,
  retry: () => Promise<void>,
  initiallyActive: boolean,
) {
  let active = initiallyActive;
  let disposed = false;
  let attempts = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const clear = () => {
    clearTimeout(timer);
    timer = undefined;
  };
  const schedule = () => {
    const state = store.getSnapshot();
    if (!state.reason) attempts = 0;
    if (disposed || !active || !state.reason || state.retrying) {
      clear();
      return;
    }
    if (timer !== undefined) return;
    timer = setTimeout(
      () => {
        timer = undefined;
        attempts++;
        void retry().finally(schedule);
      },
      Math.min(5_000 * 2 ** Math.min(attempts, 3), 30_000),
    );
  };
  const unsubscribe = store.subscribe(schedule);
  schedule();
  return {
    setActive(next: boolean) {
      if (disposed || active === next) return;
      active = next;
      clear();
      if (active && store.getSnapshot().reason) void retry().finally(schedule);
    },
    dispose() {
      disposed = true;
      clear();
      unsubscribe();
    },
  };
}
