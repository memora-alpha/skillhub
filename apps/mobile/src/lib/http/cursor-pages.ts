import { z } from "zod";
import type { RequestOptions } from "./client";
import { parsePage } from "./contracts";
import { AppError } from "./errors";

/** Read a complete bounded owner list for consumers that need a full snapshot. */
export async function readCursorPages<T>(
  call: (path: string, options?: RequestOptions) => Promise<unknown>,
  path: string,
  schema: z.ZodType<T>,
  signal?: AbortSignal,
  stopWhen?: (items: T[]) => boolean,
) {
  const items: T[] = [];
  const cursors = new Set<string>();
  let cursor: string | null = null;
  do {
    const query = new URLSearchParams({ limit: "100" });
    if (cursor) query.set("cursor", cursor);
    const page = parsePage(
      schema,
      await call(`${path}${path.includes("?") ? "&" : "?"}${query}`, {
        includeMeta: true,
        signal,
      }),
    );
    items.push(...page.items);
    if (stopWhen?.(page.items)) return items;
    cursor = page.nextCursor;
    if (cursor && cursors.has(cursor)) throw new AppError("protocol");
    if (cursor) cursors.add(cursor);
  } while (cursor);
  return items;
}
