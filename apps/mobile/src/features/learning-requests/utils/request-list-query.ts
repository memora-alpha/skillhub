import {
  infiniteQueryOptions,
  type QueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import { AppError } from "@/lib/http/errors";
import type { createRequestsApi } from "../api/requests-api";
import type { Page, RequestFilters, RequestItem } from "../types";

export function requestListOptions(
  api: ReturnType<typeof createRequestsApi>,
  key: QueryKey,
  scope: "mine" | "feed" | "recommended",
  filters: RequestFilters,
) {
  return infiniteQueryOptions({
    queryKey: [...key, "list", scope, filters],
    retry: false,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }): Promise<Page<RequestItem>> =>
      api.list(scope, filters, pageParam, signal),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
}
export function refreshRequestList(
  client: QueryClient,
  queryKey: QueryKey,
  staleOnly: boolean,
) {
  return client.refetchQueries(
    {
      queryKey,
      exact: true,
      type: "active",
      ...(staleOnly ? { stale: true } : {}),
    },
    { cancelRefetch: false },
  );
}
export function requestListItems(pages?: Page<RequestItem>[]) {
  return [
    ...new Map(
      pages?.flatMap((page) => page.items).map((item) => [item.id, item]),
    ).values(),
  ];
}
export function isInvalidRequestCursor(error: unknown) {
  return (
    error instanceof AppError &&
    error.status === 400 &&
    error.code === "INVALID_REQUEST_CURSOR"
  );
}
export async function fetchRequestNextPage(
  client: QueryClient,
  key: QueryKey,
  fetchNext: () => Promise<unknown>,
  isCurrent = () => true,
) {
  if (!isCurrent() || client.getQueryState(key)?.fetchStatus === "fetching")
    return;
  return fetchNext();
}
