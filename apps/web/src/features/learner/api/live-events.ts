type EventStream = Pick<EventSource, "onopen" | "onerror" | "close"> & {
  addEventListener(type: string, listener: EventListener): void;
};

/** Refresh authentication before each attempt; the stream does not replay gaps. */
export function createLearnerEventConnection(options: {
  prepare: () => Promise<unknown>;
  ready: () => void;
  changed: (event: Event) => void;
  eventTypes: readonly string[];
  createSource?: () => EventStream;
}) {
  let source: EventStream | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let generation = 0;
  let failures = 0;
  let enabled = false;
  let disposed = false;
  const close = () => {
    generation++;
    if (retry !== undefined) clearTimeout(retry);
    retry = undefined;
    source?.close();
    source = undefined;
  };
  const schedule = () => {
    if (!enabled || disposed || retry !== undefined) return;
    const delay = Math.min(1000 * 2 ** failures, 30000);
    failures = Math.min(failures + 1, 5);
    retry = setTimeout(() => {
      retry = undefined;
      void connect();
    }, delay);
  };
  const connect = async () => {
    close();
    if (!enabled || disposed) return;
    const ticket = generation;
    const current = () => ticket === generation && enabled && !disposed;
    try {
      await options.prepare();
      if (!current()) return;
      source = options.createSource?.() ?? new EventSource("/api/user/events");
      source.onopen = () => {
        if (!current()) return;
        failures = 0;
        options.ready();
      };
      for (const type of options.eventTypes)
        source.addEventListener(type, (event) => {
          if (current()) options.changed(event);
        });
      source.onerror = () => {
        if (!current()) return;
        close();
        schedule();
      };
    } catch {
      if (!current()) return;
      close();
      schedule();
    }
  };
  return {
    resume() {
      if (enabled || disposed) return;
      enabled = true;
      void connect();
    },
    pause() {
      enabled = false;
      close();
    },
    dispose() {
      disposed = true;
      enabled = false;
      close();
    },
  };
}
