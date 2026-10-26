export type ScreenLoadingSnapshot = Readonly<{ busy: boolean; label: string }>;

// A store belongs to one mounted screen, never to the entire navigator/session.
export function createScreenLoadingStore() {
  const pending = new Map<symbol, string>();
  const listeners = new Set<() => void>();
  let snapshot: ScreenLoadingSnapshot = {
    busy: false,
    label: "Đang tải nội dung",
  };
  const publish = () => {
    const label = pending.values().next().value ?? "Đang tải nội dung";
    const busy = pending.size > 0;
    if (snapshot.busy === busy && snapshot.label === label) return;
    snapshot = { busy, label };
    listeners.forEach((listener) => listener());
  };
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    register(id: symbol, label: string) {
      pending.set(id, label);
      publish();
      return () => {
        pending.delete(id);
        publish();
      };
    },
  };
}
export type ScreenLoadingStore = ReturnType<typeof createScreenLoadingStore>;
