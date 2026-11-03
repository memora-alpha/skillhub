import type {
  InfiniteData,
  QueryClient,
  QueryKey,
} from "@tanstack/react-query";
import type { OwnerRequest, Page, RequestItem } from "../types";
import {
  readDenial,
  requestReadGuard,
  type RequestReadGuard,
} from "./request-read";

export const REQUEST_DETAIL_CACHE_MS = 30_000;
export type RequestDetailOptions = {
  active?: boolean;
  preferOwnList?: boolean;
  waitForOwnList?: boolean;
  refreshOnFocus?: "always" | "stale";
};

// Only the current owner's validated mine projection can stand in for detail.
// A known detail denial always wins over an older list snapshot.
export function cachedOwnRequest(
  cache: QueryClient,
  base: QueryKey,
  id: string | undefined,
  access: RequestReadGuard,
  now = Date.now(),
) {
  if (
    !id ||
    access.denial ||
    readDenial(cache.getQueryState([...base, "detail", id])?.error)
  )
    return undefined;
  let best: { item: OwnerRequest; fresh: boolean } | undefined;
  for (const [key, data] of cache.getQueriesData<
    InfiniteData<Page<RequestItem>>
  >({ queryKey: [...base, "list", "mine"] })) {
    const state = cache.getQueryState(key);
    if (
      !state ||
      readDenial(state.error) ||
      requestReadGuard(cache, key).denial
    )
      continue;
    const item = data?.pages
      .flatMap((page) => page.items)
      .find((item) => item.id === id && "skillId" in item);
    if (!item || !("skillId" in item)) continue;
    const fresh =
      !state.error &&
      !state.isInvalidated &&
      now - state.dataUpdatedAt < REQUEST_DETAIL_CACHE_MS;
    if (
      !best ||
      item.version > best.item.version ||
      (item.version === best.item.version && fresh)
    )
      best = { item, fresh };
  }
  return best;
}
