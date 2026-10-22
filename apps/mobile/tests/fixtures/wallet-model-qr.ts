import type { QrPresentation } from "../../src/features/wallet/utils/payment-qr-model";
export function createQrPresentation(paymentId: string) {
  let active = true;
  let snapshot: QrPresentation = Object.freeze({
    stage: "preparing",
    paymentId,
  });
  const listeners = new Set<() => void>();
  const publish = (value: QrPresentation) => {
    snapshot = Object.freeze(value);
    for (const listener of listeners) listener();
  };
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    readyModel: (raw: string) => {
      if (active)
        publish({
          ...snapshot,
          stage: raw.length ? "ready-model" : "unavailable",
          raw: raw || undefined,
        });
    },
    renderError: () => {
      if (active && snapshot.raw)
        publish({ ...snapshot, stage: "render-error" });
    },
    retryPresentation: () => {
      if (active && snapshot.raw)
        publish({ ...snapshot, stage: "ready-model" });
    },
    close: () => {
      if (active)
        publish({ stage: "unavailable", paymentId: snapshot.paymentId });
    },
    activate: () => {
      active = true;
    },
    dispose: () => {
      active = false;
      publish({ stage: "unavailable" });
    },
  };
}
