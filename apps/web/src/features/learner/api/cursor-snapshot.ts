import { pageUrl } from "./page-url";
import { UserApiError } from "./client";

type Page<T> = {
  data: T[];
  meta?: { pagination?: { nextCursor?: string | null; hasMore?: boolean } };
};
function validatePage<T extends { id: string }>(page: Page<T>) {
  if (
    !Array.isArray(page.data) ||
    page.data.some((item) => !item || typeof item.id !== "string")
  )
    throw new UserApiError(502, "API_RESPONSE_INVALID");
  const pagination = page.meta?.pagination;
  if (
    !pagination ||
    typeof pagination.hasMore !== "boolean" ||
    pagination.hasMore !== !!pagination.nextCursor
  )
    throw new UserApiError(502, "API_RESPONSE_INVALID");
  return pagination;
}
/** A complete snapshot (or an authoritative matching item), never a partial success. */
export async function readCursorSnapshot<T extends { id: string }>(
  read: (path: string, signal?: AbortSignal) => Promise<Page<T>>,
  path: string,
  signal?: AbortSignal,
  stopAt?: (item: T) => boolean,
) {
  const items = new Map<string, T>();
  const cursors = new Set<string>();
  let cursor: string | undefined;
  do {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const page = await read(pageUrl(path, cursor), signal);
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const pagination = validatePage(page);
    for (const item of page.data) items.set(item.id, item);
    if (stopAt && page.data.some(stopAt)) return [...items.values()];
    const next = pagination.nextCursor;
    if (
      next != null &&
      (typeof next !== "string" || !next || cursors.has(next))
    )
      throw new UserApiError(502, "API_RESPONSE_INVALID");
    cursor = next ?? undefined;
    if (cursor) cursors.add(cursor);
  } while (cursor);
  return [...items.values()];
}
