import { readCursorSnapshot } from "../api/cursor-snapshot";
import type { Reply } from "../types";

type ReadState = { id: string; readAt: string | null };

export async function markAllNotificationsRead(
  read: (path: string, signal: AbortSignal) => Promise<Reply<ReadState[]>>,
  mark: (id: string, signal: AbortSignal) => Promise<unknown>,
  signal: AbortSignal,
) {
  // Capture the inbox before changing it; new notifications remain unread.
  const snapshot = await readCursorSnapshot<ReadState>(
    (path) => read(path, signal),
    "notifications?limit=100",
    signal,
  );
  const ids = snapshot
    .filter((item) => item.readAt === null)
    .map((item) => item.id);
  const updated: string[] = [];
  for (let start = 0; start < ids.length; start += 3) {
    signal.throwIfAborted();
    const batch = ids.slice(start, start + 3);
    const results = await Promise.allSettled(
      batch.map((id) => mark(id, signal)),
    );
    signal.throwIfAborted();
    results.forEach((result, index) => {
      if (result.status === "fulfilled") updated.push(batch[index]!);
    });
    if (results.some((result) => result.status === "rejected"))
      return { updated, complete: false };
  }
  return { updated, complete: true };
}
