export type ConnectionState = {
  reason: "offline" | "unreachable" | null;
  retrying: boolean;
};
export function createConnectionStore() {
  let state: ConnectionState = { reason: null, retrying: false };
  let failures = 0;
  const listeners = new Set<() => void>();
  const publish = (next: ConnectionState) => {
    if (next.reason === state.reason && next.retrying === state.retrying)
      return;
    state = next;
    listeners.forEach((listener) => listener());
  };
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    unavailable(reason: "offline" | "unreachable" = "unreachable") {
      failures++;
      publish({
        ...state,
        reason: state.reason === "offline" ? "offline" : reason,
      });
    },
    beginRetry() {
      if (state.retrying || !state.reason) return null;
      publish({ ...state, retrying: true });
      return failures;
    },
    deviceConnected() {
      if (state.reason === "offline")
        publish({ ...state, reason: "unreachable" });
    },
    finishRetry(ticket: number, connected: boolean) {
      publish({
        reason: connected && failures === ticket ? null : state.reason,
        retrying: false,
      });
    },
  };
}
export const connectionStore = createConnectionStore();

export function deviceOffline(state: {
  isConnected?: boolean;
  isInternetReachable?: boolean;
}) {
  return state.isConnected === false || state.isInternetReachable === false;
}
