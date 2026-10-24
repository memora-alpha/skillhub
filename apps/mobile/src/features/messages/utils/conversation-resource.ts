import type { QueryClient } from "@tanstack/react-query";
import type { RequestOptions } from "@/lib/http/client";
import { AppError } from "@/lib/http/errors";

// Cache source resources once per owner/session, independently of label formatting.
export async function readConversationResource(
  cache: QueryClient,
  base: readonly unknown[],
  call: (path: string, options?: RequestOptions) => Promise<unknown>,
  path: string,
  options?: RequestOptions,
  conversationId?: string,
) {
  if (options?.signal?.aborted) throw new AppError("session");
  const queryKey = [...base, "conversation-resource", path];
  const previous = cache.getQueryCache().find({ queryKey, exact: true })
    ?.meta?.conversationIds;
  const conversationIds = new Set(Array.isArray(previous) ? previous : []);
  if (conversationId) conversationIds.add(conversationId);
  const result = await cache.fetchQuery({
    queryKey,
    staleTime: 30_000,
    retry: false,
    meta: { refreshResource: true, conversationIds: [...conversationIds] },
    queryFn: ({ signal }) => call(path, { ...options, signal }),
  });
  if (options?.signal?.aborted) throw new AppError("session");
  return result;
}

export function invalidateConversationResources(
  cache: QueryClient,
  base: readonly unknown[],
  conversationId: string,
) {
  return cache.invalidateQueries({
    queryKey: [...base, "conversation-resource"],
    predicate: (query) => {
      const ids = query.meta?.conversationIds;
      return Array.isArray(ids) && ids.includes(conversationId);
    },
    refetchType: "none",
  });
}
