import { chatEventReference } from "./event-reference";
import type { QueryClient } from "@tanstack/react-query";
import { AppError } from "@/lib/http/errors";
import type { SseFrame } from "./sse-parser";
import { cancelMessageTail } from "./message-tail";

type Prefix = readonly unknown[];
const recoveryPrefixes: Prefix[] = [
  ["conversations"],
  ["conversation-preview"],
  ["conversation"],
  ["thread"],
  ["delivery"],
  ["chat-file"],
  ["proposals"],
  ["proposal"],
  ["notifications"],
];
export async function reloadChatEventQueries(
  cache: QueryClient,
  base: Prefix,
  prefixes: readonly Prefix[],
  receiptsFor?: string,
  assertCurrent: () => void = () => {},
  attachmentsFor?: string,
) {
  assertCurrent();
  // A request started before this event cannot confirm its new state.
  await Promise.all(
    prefixes
      .filter((prefix) => prefix[0] === "thread")
      .map((prefix) =>
        cancelMessageTail(cache, base, prefix[1] as string | undefined),
      ),
  );
  assertCurrent();
  const markReceipts = (id: string) =>
    cache.setQueryData<number>(
      [...base, "thread-receipts", id],
      (revision = 0) => revision + 1,
    );
  if (receiptsFor) markReceipts(receiptsFor);
  const markAttachments = (id: string) =>
    cache.setQueryData<number>(
      [...base, "thread-attachments", id],
      (revision = 0) => revision + 1,
    );
  if (attachmentsFor) markAttachments(attachmentsFor);
  // A fresh stream starts at the server head. Refresh read receipts missed offline,
  // including messages in already loaded older pages.
  if (
    prefixes.some((prefix) => prefix.length === 1 && prefix[0] === "thread")
  ) {
    cache
      .getQueryCache()
      .findAll({ queryKey: [...base, "thread"] })
      .forEach((query) => {
        const id = query.queryKey[base.length + 1];
        if (typeof id === "string") {
          markReceipts(id);
          markAttachments(id);
        }
      });
  }
  return Promise.all(
    prefixes.map((prefix) =>
      cache.invalidateQueries(
        {
          queryKey: [...base, ...prefix],
          // A row may be offscreen. Refresh only this preview even when inactive.
          ...(prefix[0] === "conversations" && prefix[1] === "preview"
            ? { refetchType: "all" as const }
            : {}),
        },
        { throwOnError: true },
      ),
    ),
  );
}

// Cursor acknowledgment follows a successful snapshot reload. A checkpoint only
// skips an event the server has explicitly hidden; it must not trigger reads.
export function createChatEventHydrator(options: {
  reload: (
    prefixes: Prefix[],
    receiptsFor?: string,
    attachmentsFor?: string,
  ) => Promise<unknown>;
  assertCurrent: () => void;
  renew: () => Promise<unknown>;
  ready: () => void;
  receive?: (frame: SseFrame, signal: AbortSignal) => Promise<unknown>;
}) {
  let cursor: string | undefined;
  let snapshotReady = false;
  const processed = new Set<string>();
  const reset = () => {
    cursor = undefined;
    snapshotReady = false;
    processed.clear();
  };
  const reloadReady = async (signal: AbortSignal) => {
    // Polling may have stopped while moderation was still pending. A resumed
    // stream must catch up file status even when no update frame is replayed.
    await options.reload(
      !snapshotReady || !cursor
        ? recoveryPrefixes
        : [["chat-file"], ["thread"]],
    );
    if (signal.aborted) return;
    options.assertCurrent();
    snapshotReady = true;
    options.ready();
  };
  const reloadEvent = async (frame: SseFrame, signal: AbortSignal) => {
    const event = chatEventReference(frame);
    if (!event || processed.has(event.eventId)) return;
    await options.reload(
      event.prefixes,
      event.receiptsFor,
      event.attachmentsFor,
    );
    if (signal.aborted) return;
    options.assertCurrent();
    processed.add(event.eventId);
    if (processed.size > 500)
      processed.delete(processed.values().next().value!);
  };
  return {
    get cursor() {
      return cursor;
    },
    reset,
    async handle(frame: SseFrame, signal: AbortSignal) {
      if (signal.aborted) return;
      options.assertCurrent();
      if (frame.event === "stream.reauth-required") {
        await options.renew();
        throw new AppError("http", 401);
      }
      if (frame.event === "stream.reset-required") {
        reset();
        throw new AppError("http", 409, "EVENT_CURSOR_EXPIRED");
      }
      await options.receive?.(frame, signal);
      if (signal.aborted) return;
      options.assertCurrent();
      if (frame.event === "stream.ready") {
        await reloadReady(signal);
      } else {
        await reloadEvent(frame, signal);
      }
      if (!signal.aborted && frame.id !== undefined) cursor = frame.id;
    },
  };
}
