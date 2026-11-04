import { UserApiError } from "./client";
import type { Reply } from "../types";

type ReadPage = (path: string, signal: AbortSignal) => Promise<Reply<unknown>>;

function isNotification(
  value: unknown,
): value is { id: string; readAt: string | null } {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    item.id.length > 0 &&
    (item.readAt === null ||
      (typeof item.readAt === "string" &&
        Number.isFinite(Date.parse(item.readAt))))
  );
}

// The inbox API has neither an unread filter nor a total. Read cursor pages,
// including old unread items, and stop once the badge can truthfully say 99+.
export async function countUnreadNotifications(
  readPage: ReadPage,
  signal: AbortSignal,
) {
  let cursor: string | null = null;
  let count = 0;
  const cursors = new Set<string>();
  const ids = new Set<string>();
  do {
    signal.throwIfAborted();
    const query = new URLSearchParams({ limit: "100" });
    if (cursor) query.set("cursor", cursor);
    const reply = await readPage("notifications?" + query, signal);
    signal.throwIfAborted();
    const { items, page } = notificationPage(reply, cursors);
    for (const item of items) {
      if (!ids.has(item.id) && item.readAt === null) count++;
      ids.add(item.id);
    }
    if (count > 99) return 100;
    cursor = page.nextCursor;
    if (cursor) cursors.add(cursor);
  } while (cursor);
  return count;
}

function notificationPage(reply: Reply<unknown>, cursors: Set<string>) {
  const page = reply.meta?.pagination;
  if (
    !Array.isArray(reply.data) ||
    !reply.data.every(isNotification) ||
    !page ||
    !Number.isInteger(page.limit) ||
    page.limit < 1 ||
    page.limit > 100 ||
    typeof page.hasMore !== "boolean" ||
    !(
      page.nextCursor === null ||
      (typeof page.nextCursor === "string" && page.nextCursor.length > 0)
    ) ||
    page.hasMore !== (page.nextCursor !== null) ||
    (page.hasMore && reply.data.length === 0) ||
    (page.nextCursor !== null && cursors.has(page.nextCursor))
  ) {
    throw new UserApiError(502, "API_RESPONSE_INVALID");
  }
  return { items: reply.data, page };
}
