import { StaffApiError } from "./client";
import { validNotificationId } from "./notification-inbox";

export type EventFrame = { event: string; id?: string; data: string };
export function createEventParser() {
  let buffer = "";
  return {
    feed(chunk: string): EventFrame[] {
      buffer += chunk;
      if (buffer.length > 262144)
        throw new StaffApiError(502, "API_RESPONSE_INVALID");
      const frames: EventFrame[] = [];
      while (true) {
        const end = /\r?\n\r?\n/.exec(buffer);
        if (!end) return frames;
        const block = buffer.slice(0, end.index);
        buffer = buffer.slice(end.index + end[0].length);
        const frame: EventFrame = { event: "message", data: "" };
        const data: string[] = [];
        for (const line of block.split(/\r?\n/)) {
          if (line.startsWith(":")) continue;
          const split = line.indexOf(":");
          const field = split < 0 ? line : line.slice(0, split);
          let value = split < 0 ? "" : line.slice(split + 1);
          if (value.startsWith(" ")) value = value.slice(1);
          if (field === "id" && !value.includes("\0")) frame.id = value;
          if (field === "event") frame.event = value;
          if (field === "data") data.push(value);
        }
        if (data.length || frame.event.startsWith("stream."))
          frames.push({ ...frame, data: data.join("\n") });
      }
    },
  };
}
export function createNotificationHydrator(options: {
  reload: () => Promise<unknown>;
  renew: () => Promise<unknown>;
  ready: () => void;
}) {
  let cursor: string | undefined;
  const processed = new Set<string>();
  return {
    get cursor() {
      return cursor;
    },
    reset() {
      cursor = undefined;
      processed.clear();
    },
    async handle(frame: EventFrame, signal: AbortSignal) {
      if (signal.aborted) return;
      if (frame.event === "stream.reset-required") {
        this.reset();
        throw new StaffApiError(409, "EVENT_CURSOR_EXPIRED");
      }
      if (frame.event === "stream.reauth-required") {
        await options.renew();
        throw new StaffApiError(0, "STREAM_RECONNECT");
      }
      if (frame.event === "stream.ready") {
        await options.reload();
        if (!signal.aborted) options.ready();
      } else if (
        ["notification.created", "notification.read"].includes(frame.event)
      ) {
        let value: {
          eventId?: unknown;
          version?: unknown;
          data?: { notificationId?: unknown };
        };
        try {
          value = JSON.parse(frame.data);
        } catch {
          throw new StaffApiError(502, "API_RESPONSE_INVALID");
        }
        if (
          !value ||
          !validNotificationId(value.eventId) ||
          value.version !== 1 ||
          !validNotificationId(value.data?.notificationId)
        )
          throw new StaffApiError(502, "API_RESPONSE_INVALID");
        if (!processed.has(value.eventId)) {
          await options.reload();
          if (signal.aborted) return;
          processed.add(value.eventId);
          if (processed.size > 500)
            processed.delete(processed.values().next().value!);
        }
      }
      if (!signal.aborted && frame.id !== undefined) cursor = frame.id;
    },
  };
}
export async function consumeNotificationEvents(
  body: ReadableStream<Uint8Array>,
  hydrator: ReturnType<typeof createNotificationHydrator>,
  signal: AbortSignal,
) {
  const reader = body.getReader(),
    decoder = new TextDecoder(),
    parser = createEventParser();
  try {
    while (!signal.aborted) {
      const chunk = await reader.read();
      if (chunk.done) break;
      // Hydration order defines the last safe replay cursor; never parallelize frames.
      for (const frame of parser.feed(
        decoder.decode(chunk.value, { stream: true }),
      ))
        await hydrator.handle(frame, signal);
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
