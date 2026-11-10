export type ConnectionReason = "offline" | "unreachable";
export type ConnectionState = {
  reason: ConnectionReason | null;
  retrying: boolean;
};
export const connectedState: ConnectionState = {
  reason: null,
  retrying: false,
};

export function createConnectionStore() {
  let state = connectedState;
  let failures = 0;
  let flight: Promise<boolean> | undefined;
  const subscribers = new Set<() => void>();
  const restored = new Set<() => void>();
  function publish(next: ConnectionState) {
    if (state.reason === next.reason && state.retrying === next.retrying)
      return;
    state = next;
    subscribers.forEach((listener) => listener());
  }
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) {
      subscribers.add(listener);
      return () => {
        subscribers.delete(listener);
      };
    },
    onRestored(listener: () => void) {
      restored.add(listener);
      return () => {
        restored.delete(listener);
      };
    },
    unavailable(reason: ConnectionReason) {
      failures++;
      publish({
        ...state,
        reason: state.reason === "offline" ? "offline" : reason,
      });
    },
    deviceOnline() {
      if (state.reason === "offline")
        publish({ ...state, reason: "unreachable" });
    },
    retry(probe: () => Promise<boolean>) {
      if (flight) return flight;
      if (!state.reason) return Promise.resolve(true);
      const ticket = failures;
      publish({ ...state, retrying: true });
      flight = Promise.resolve()
        .then(probe)
        .catch(() => false)
        .then((reachable) => {
          const recovered = reachable && failures === ticket;
          publish({ reason: recovered ? null : state.reason, retrying: false });
          if (recovered) restored.forEach((listener) => listener());
          return recovered;
        })
        .finally(() => {
          flight = undefined;
        });
      return flight;
    },
  };
}

export const connectionStore = createConnectionStore();
export const onConnectionRestored = connectionStore.onRestored;

export function isConnectionFailure(error: unknown) {
  if (!error || typeof error !== "object") return false;
  return (
    ("status" in error && error.status === 0) ||
    ("code" in error &&
      typeof error.code === "string" &&
      ["API_UNAVAILABLE", "NETWORK_ERROR"].includes(error.code))
  );
}
