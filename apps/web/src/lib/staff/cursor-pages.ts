import { StaffApiError } from "./client";
import { appendCursor } from "./pagination";
import type { ApiEnvelope, Pagination } from "./types";

export type CursorPage<T> = {
  items: T[];
  page: Pagination;
  pageNumber: number;
  totalPages?: number;
};

function assertActive(signal: AbortSignal) {
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");
}
function checkedPagination<T extends { id: string }>(reply: ApiEnvelope<T[]>) {
  const page = reply.meta?.pagination;
  if (
    !Array.isArray(reply.data) ||
    reply.data.some((item) => !item || typeof item.id !== "string") ||
    !page ||
    !Number.isSafeInteger(page.limit) ||
    page.limit < 1 ||
    reply.data.length > page.limit ||
    typeof page.hasMore !== "boolean" ||
    (page.nextCursor !== null &&
      (typeof page.nextCursor !== "string" || !page.nextCursor)) ||
    page.hasMore !== !!page.nextCursor ||
    (page.total !== undefined &&
      (!Number.isSafeInteger(page.total) || page.total < 0))
  )
    throw new StaffApiError(502, "API_RESPONSE_INVALID");
  return page;
}

/** Numbered UI over the server's opaque cursors; no offset or fabricated cursor. */
export function createCursorPages<T extends { id: string }>(
  path: string,
  read: (path: string, signal: AbortSignal) => Promise<ApiEnvelope<T[]>>,
) {
  const cached = new Map<number, { items: T[]; page: Pagination }>();
  const cursors = new Map<number, string | undefined>([[1, undefined]]);
  const positions = new Map<string, number>();
  let totalPages: number | undefined;
  let lastPage: number | undefined;
  let limit: number | undefined;
  function clear() {
    cached.clear();
    cursors.clear();
    cursors.set(1, undefined);
    positions.clear();
    totalPages = undefined;
    lastPage = undefined;
    limit = undefined;
  }
  function result(
    pageNumber: number,
    data: { items: T[]; page: Pagination },
  ): CursorPage<T> {
    cached.delete(pageNumber);
    cached.set(pageNumber, data);
    // Keep rows bounded; cursor bookmarks let evicted pages be fetched directly.
    if (cached.size > 40) cached.delete(cached.keys().next().value!);
    return { ...data, pageNumber, totalPages: lastPage ?? totalPages };
  }
  async function get(
    target: number,
    signal: AbortSignal,
  ): Promise<CursorPage<T>> {
    assertActive(signal);
    if (!Number.isSafeInteger(target) || target < 1)
      throw new RangeError("Trang không hợp lệ.");
    if (lastPage !== undefined) target = Math.min(target, lastPage);
    const found = cached.get(target);
    if (found) return result(target, found);
    let index = 1;
    for (const known of cursors.keys())
      if (known <= target && known > index) index = known;
    while (index <= target) {
      assertActive(signal);
      const cursor = cursors.get(index);
      const reply = await read(appendCursor(path, cursor), signal);
      assertActive(signal);
      const page = checkedPagination(reply);
      if (limit !== undefined && page.limit !== limit)
        throw new StaffApiError(502, "API_RESPONSE_INVALID");
      const nextPosition = page.nextCursor
        ? positions.get(page.nextCursor)
        : undefined;
      if (
        page.nextCursor &&
        (page.nextCursor === cursor ||
          (nextPosition !== undefined && nextPosition !== index + 1))
      )
        throw new StaffApiError(502, "API_RESPONSE_INVALID");
      limit = page.limit;
      if (page.total !== undefined)
        totalPages = Math.max(1, Math.ceil(page.total / page.limit));
      if (page.nextCursor) {
        cursors.set(index + 1, page.nextCursor);
        positions.set(page.nextCursor, index + 1);
      } else lastPage = index;
      const snapshot = result(index, { items: reply.data, page });
      if (index === target || !page.hasMore) return snapshot;
      index++;
    }
    throw new StaffApiError(502, "API_RESPONSE_INVALID");
  }
  return { get, clear };
}

export { pageWindow } from "../pagination/page-window";
