import type { Reply } from "../types";
import type { UserRequestOptions } from "./client";
import { UserApiError } from "./client";
type Request = <T>(
  path: string,
  options?: UserRequestOptions,
) => Promise<Reply<T>>;
export async function findInPages<T>(
  request: Request,
  path: string,
  predicate: (item: T) => boolean,
) {
  let cursor: string | undefined;
  const seen = new Set<string>();
  do {
    const reply = await request<T[]>(
      path +
        (cursor
          ? (path.includes("?") ? "&" : "?") + new URLSearchParams({ cursor })
          : ""),
    );
    if (!Array.isArray(reply.data))
      throw new UserApiError(502, "API_RESPONSE_INVALID");
    const item = reply.data.find(predicate);
    if (item) return item;
    cursor = reply.meta?.pagination?.nextCursor ?? undefined;
    if (cursor && seen.has(cursor))
      throw new UserApiError(502, "API_RESPONSE_INVALID");
    if (cursor) seen.add(cursor);
  } while (cursor);
  return undefined;
}
