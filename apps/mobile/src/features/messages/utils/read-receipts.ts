import { AppError } from "@/lib/http/errors";
import {
  mergeMessages,
  type ApiMessage,
  type createMessagesApi,
} from "../api/messages-api";

// Read-update events contain a watermark, not a timestamp. Read actual readAt
// values from history instead of inventing timestamps for older cached messages.
export async function refreshLoadedReadReceipts(
  api: Pick<ReturnType<typeof createMessagesApi>, "history">,
  id: string,
  messages: ApiMessage[],
  userId: string | undefined,
  signal: AbortSignal,
) {
  const unread = messages.filter(
    (message) => message.senderId === userId && !message.readAt,
  );
  if (!unread.length) return messages;
  const oldest = unread.reduce(
    (value, message) =>
      BigInt(message.sequence) < value ? BigInt(message.sequence) : value,
    BigInt(unread[0]!.sequence),
  );
  let cursor: string | undefined;
  const seen = new Set<string>();
  let result = messages;
  while (true) {
    if (signal.aborted) throw new AppError("network");
    const page = await api.history(id, { cursor, signal });
    result = mergeMessages(result, page.items);
    if (
      !page.hasMore ||
      page.items.some((message) => BigInt(message.sequence) <= oldest)
    )
      return result;
    if (!page.items.length || !page.nextCursor || seen.has(page.nextCursor))
      throw new AppError("protocol");
    seen.add(page.nextCursor);
    cursor = page.nextCursor;
  }
}
