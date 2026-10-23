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
) {
  if (options?.signal?.aborted) throw new AppError("session");
  const result = await cache.fetchQuery({
    queryKey: [...base, "conversation-resource", path],
    staleTime: 30_000,
    retry: false,
    meta: { refreshResource: true },
    queryFn: ({ signal }) => call(path, { ...options, signal }),
  });
  if (options?.signal?.aborted) throw new AppError("session");
  return result;
}
