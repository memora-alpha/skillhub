import { AppError } from "@/lib/http/errors";
import {
  mergeMessages,
  type ApiMessage,
  type createMessagesApi,
} from "../api/messages-api";
import { refreshLoadedReadReceipts } from "./read-receipts";

export type ThreadSnapshot = {
  messages: ApiMessage[];
  nextCursor: string | null;
  receiptRevision?: number;
};

export async function readThreadSnapshot(
  api: Pick<ReturnType<typeof createMessagesApi>, "history">,
  id: string,
  options: {
    signal: AbortSignal;
    latestOnly: boolean;
    previous?: ThreadSnapshot;
    receiptRevision: number;
    userId?: string;
    current: () => ThreadSnapshot | undefined;
    assertCurrent: () => void;
  },
): Promise<ThreadSnapshot> {
  const { signal, previous, receiptRevision } = options;
  // Always read the tail first. Entering Chat never walks an old offline gap.
  const tail = await api.history(id, { signal });
  options.assertCurrent();
  const last = previous?.messages.at(-1)?.sequence;
  if (options.latestOnly || !last)
    return {
      messages: mergeMessages(tail.items),
      nextCursor: tail.nextCursor,
      receiptRevision,
    };
  let messages = previous!.messages;
  const firstTail = tail.items[0]?.sequence;
  if (firstTail && BigInt(firstTail) > BigInt(last) + 1n) {
    let after = last;
    const seen = new Set<string>();
    while (true) {
      if (signal.aborted || seen.has(after)) throw new AppError("protocol");
      seen.add(after);
      const page = await api.history(id, { afterSequence: after, signal });
      messages = mergeMessages(messages, page.items);
      const next = page.items.at(-1)?.sequence;
      if (!page.hasMore || (next && BigInt(next) >= BigInt(firstTail))) break;
      if (!next || BigInt(next) <= BigInt(after))
        throw new AppError("protocol");
      after = next;
    }
  }
  messages = mergeMessages(
    options.current()?.messages ?? [],
    messages,
    tail.items,
  );
  if ((previous?.receiptRevision ?? 0) !== receiptRevision) {
    messages = await refreshLoadedReadReceipts(
      api,
      id,
      messages,
      options.userId,
      signal,
    );
  }
  options.assertCurrent();
  const current = options.current();
  return {
    messages: mergeMessages(current?.messages ?? [], messages),
    nextCursor: current ? current.nextCursor : previous!.nextCursor,
    receiptRevision,
  };
}
