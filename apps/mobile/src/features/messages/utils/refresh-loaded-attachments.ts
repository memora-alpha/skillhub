import { AppError } from "@/lib/http/errors";
import {
  mergeMessages,
  type ApiMessage,
  type createMessagesApi,
} from "../api/messages-api";

// History has no GET-by-message-ID. Re-read loaded file messages by sequence in
// batches, skipping gaps and retaining the user's existing pagination boundary.
export async function refreshLoadedAttachments(
  api: Pick<ReturnType<typeof createMessagesApi>, "history">,
  id: string,
  messages: ApiMessage[],
  tail: ApiMessage[],
  signal: AbortSignal,
) {
  const loaded = new Set(messages.map((message) => message.id));
  const fresh = new Set(tail.map((message) => message.id));
  let remaining = messages.filter(
    (message) => message.attachments.length && !fresh.has(message.id),
  );
  let result = messages;
  while (remaining.length) {
    if (signal.aborted) throw new AppError("network");
    const oldest = remaining.reduce((a, b) =>
      BigInt(a.sequence) < BigInt(b.sequence) ? a : b,
    );
    const sequence = BigInt(oldest.sequence);
    if (sequence < 1n) throw new AppError("protocol");
    const page = await api.history(id, {
      afterSequence: String(sequence - 1n),
      limit: 100,
      signal,
    });
    if (signal.aborted) throw new AppError("network");
    if (!page.items.some((message) => message.id === oldest.id))
      throw new AppError("protocol");
    result = mergeMessages(
      result,
      page.items.filter((message) => loaded.has(message.id)),
    );
    const read = new Set(page.items.map((message) => message.id));
    remaining = remaining.filter((message) => !read.has(message.id));
  }
  return result;
}
