type EventStream = Pick<EventSource, "onopen" | "onerror" | "close"> & {
  addEventListener(type: string, listener: EventListener): void;
};

/** Refresh authentication before reconnecting and carry the last replay cursor. */
export function createLearnerEventConnection(options: {
  prepare: () => Promise<unknown>;
  ready: () => void;
  changed: (event: Event) => void;
  eventTypes: readonly string[];
  createSource?: (cursor?: string) => EventStream;
}) {
  let source: EventStream | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let generation = 0;
  let failures = 0;
  let enabled = false;
  let disposed = false;
  let cursor: string | undefined;
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
      source =
        options.createSource?.(cursor) ??
        new EventSource(
          "/api/user/events" +
            (cursor ? "?cursor=" + encodeURIComponent(cursor) : ""),
        );
      source.onopen = () => {
        if (!current()) return;
        failures = 0;
        options.ready();
      };
      const remember = (event: Event) => {
        if (event instanceof MessageEvent && event.lastEventId.length <= 1024)
          cursor = event.lastEventId || undefined;
      };
      source.addEventListener("stream.ready", (event) => {
        if (current()) remember(event);
      });
      source.addEventListener("stream.checkpoint", (event) => {
        if (current()) remember(event);
      });
      source.addEventListener("stream.reauth-required", () => {
        if (!current()) return;
        close();
        schedule();
      });
      for (const type of options.eventTypes)
        source.addEventListener(type, (event) => {
          if (!current()) return;
          if (type === "stream.reset-required") cursor = undefined;
          else remember(event);
          options.changed(event);
          if (type === "stream.reset-required") {
            close();
            schedule();
          }
        });
      source.onerror = () => {
        if (!current()) return;
        // EventSource does not expose an expired-cursor HTTP response. After a
        // failed replay attempt, recover from a fresh authenticated snapshot.
        if (failures > 0) cursor = undefined;
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
