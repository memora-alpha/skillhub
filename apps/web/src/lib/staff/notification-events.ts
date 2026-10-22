import { StaffApiError } from "./client";
import { validNotificationId } from "./notification-inbox";

export type EventFrame = { event: string; id?: string; data: string };
function readEventLine(frame: EventFrame, data: string[], line: string) {
  if (line.startsWith(":")) return;
  const split = line.indexOf(":");
  const field = split < 0 ? line : line.slice(0, split);
  let value = split < 0 ? "" : line.slice(split + 1);
  if (value.startsWith(" ")) value = value.slice(1);
  if (field === "id" && !value.includes("\0")) frame.id = value;
  if (field === "event") frame.event = value;
  if (field === "data") data.push(value);
}
function parseEventFrame(block: string): EventFrame | null {
  const frame: EventFrame = { event: "message", data: "" };
  const data: string[] = [];
  for (const line of block.split(/\r?\n/)) readEventLine(frame, data, line);
  if (!data.length && !frame.event.startsWith("stream.")) return null;
  return { ...frame, data: data.join("\n") };
}
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
        const frame = parseEventFrame(block);
        if (frame) frames.push(frame);
      }
    },
  };
}
function notificationEventId(data: string) {
  let value: {
    eventId?: unknown;
    version?: unknown;
    data?: { notificationId?: unknown };
  };
  try {
    value = JSON.parse(data);
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
  return value.eventId;
}
export function createNotificationHydrator(options: {
  reload: () => Promise<unknown>;
  renew: () => Promise<unknown>;
  ready: () => void;
}) {
  let cursor: string | undefined;
  const processed = new Set<string>();
  const reset = () => {
    cursor = undefined;
    processed.clear();
  };
  async function hydrateNotification(frame: EventFrame, signal: AbortSignal) {
    const id = notificationEventId(frame.data);
    if (processed.has(id)) return;
    await options.reload();
    if (signal.aborted) return;
    processed.add(id);
    if (processed.size > 500)
      processed.delete(processed.values().next().value!);
  }
  return {
    get cursor() {
      return cursor;
    },
    reset,
    async handle(frame: EventFrame, signal: AbortSignal) {
      if (signal.aborted) return;
      switch (frame.event) {
        case "stream.reset-required":
          reset();
          throw new StaffApiError(409, "EVENT_CURSOR_EXPIRED");
        case "stream.reauth-required":
          await options.renew();
          throw new StaffApiError(0, "STREAM_RECONNECT");
        case "stream.ready":
          await options.reload();
          if (!signal.aborted) options.ready();
          break;
        case "notification.created":
        case "notification.read":
          await hydrateNotification(frame, signal);
          break;
      }
      if (!signal.aborted && frame.id !== undefined) cursor = frame.id;
    },
  };
}
async function* readEventFrames(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  signal: AbortSignal,
) {
  const decoder = new TextDecoder(),
    parser = createEventParser();
  while (!signal.aborted) {
    const chunk = await reader.read();
    if (chunk.done) return;
    yield* parser.feed(decoder.decode(chunk.value, { stream: true }));
  }
}
export async function consumeNotificationEvents(
  body: ReadableStream<Uint8Array>,
  hydrator: ReturnType<typeof createNotificationHydrator>,
  signal: AbortSignal,
) {
  const reader = body.getReader();
  try {
    // Each hydration must finish before advancing the safe replay cursor.
    for await (const frame of readEventFrames(reader, signal))
      await hydrator.handle(frame, signal);
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
