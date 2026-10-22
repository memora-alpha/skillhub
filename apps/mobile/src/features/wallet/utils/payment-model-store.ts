// Small local observation store; never a financial query/entity cache.
export function paymentModelStore<T>(initial: T) {
  let snapshot = Object.freeze(initial);
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => snapshot as T,
    publish: (value: T) => {
      snapshot = Object.freeze(value);
      for (const listener of listeners) {
        try {
          listener();
        } catch {
          /* An observer cannot interrupt cleanup/guards. */
        }
      }
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
