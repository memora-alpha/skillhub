import { useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AppError } from "@/lib/http/errors";
import { connectionReadAccess } from "@/lib/http/read-access";
import { uuid } from "@/lib/http/contracts";
import {
  useConnections,
  useConnectionList,
  useConnectionQuery,
} from "@/features/connections";
import {
  createMessagesApi,
  mergeMessages,
  type ApiMessage,
} from "../api/messages-api";
import { refreshLoadedReadReceipts } from "../utils/read-receipts";

export function useMessagesApi() {
  const { call, userId } = useConnections();
  return useMemo(() => createMessagesApi(call, userId ?? ""), [call, userId]);
}
export function useConversations() {
  const api = useMessagesApi();
  return useConnectionList(["conversations"], (cursor, signal) =>
    api.list(cursor, signal),
  );
}
export function useConversation(id: string) {
  const api = useMessagesApi();
  return useConnectionQuery(
    ["conversation", id],
    (signal) => api.detail(id, signal),
    uuid.safeParse(id).success,
  );
}
type Thread = {
  messages: ApiMessage[];
  nextCursor: string | null;
  receiptRevision?: number;
};
export function useThread(id: string, enabled: boolean) {
  const api = useMessagesApi(),
    runtime = useConnections(),
    cache = useQueryClient();
  const key = [...runtime.key, "thread", id];
  const loadingOlder = useRef(false);
  const [olderPending, setOlderPending] = useState(false);
  const [olderError, setOlderError] = useState<unknown>();
  const query = useConnectionQuery<Thread>(
    ["thread", id],
    async (signal) => {
      const previous = cache.getQueryData<Thread>(key);
      const receiptRevision =
        cache.getQueryData<number>([...runtime.key, "thread-receipts", id]) ??
        0;
      const last = previous?.messages.at(-1)?.sequence;
      if (!last) {
        const page = await api.history(id, { signal });
        return {
          messages: mergeMessages(page.items),
          nextCursor: page.nextCursor,
          receiptRevision,
        };
      }
      let after = last,
        messages = previous!.messages;
      const seen = new Set<string>();
      while (true) {
        if (seen.has(after)) throw new AppError("protocol");
        seen.add(after);
        const page = await api.history(id, { afterSequence: after, signal });
        messages = mergeMessages(messages, page.items);
        if (!page.hasMore) break;
        const next = page.items.at(-1)?.sequence;
        if (!next || BigInt(next) <= BigInt(after))
          throw new AppError("protocol");
        after = next;
      }
      runtime.assertCurrent();
      // A concurrent older-history load may have extended the snapshot.
      const preview = await api.history(id, { signal });
      const latest = cache.getQueryData<Thread>(key);
      let merged = mergeMessages(
        latest?.messages ?? [],
        messages,
        preview.items,
      );
      if ((previous?.receiptRevision ?? 0) !== receiptRevision) {
        merged = await refreshLoadedReadReceipts(
          api,
          id,
          merged,
          runtime.userId,
          signal,
        );
      }
      runtime.assertCurrent();
      const current = cache.getQueryData<Thread>(key);
      return {
        messages: mergeMessages(current?.messages ?? [], merged),
        nextCursor: current ? current.nextCursor : previous!.nextCursor,
        receiptRevision,
      };
    },
    enabled && uuid.safeParse(id).success,
  );
  const loadOlder = async () => {
    const previous = query.data;
    if (!previous?.nextCursor || query.isFetching || loadingOlder.current)
      return;
    loadingOlder.current = true;
    setOlderPending(true);
    setOlderError(undefined);
    try {
      const page = await connectionReadAccess(cache, key).read(
        () => api.history(id, { cursor: previous.nextCursor! }),
        runtime.isCurrent,
      );
      runtime.assertCurrent();
      if (page.hasMore && page.nextCursor === previous.nextCursor)
        throw new AppError("protocol");
      cache.setQueryData<Thread>(key, (current) => ({
        ...current,
        messages: mergeMessages(page.items, current?.messages ?? []),
        nextCursor: page.nextCursor,
      }));
    } catch (error) {
      if (runtime.isCurrent()) setOlderError(error);
    } finally {
      if (runtime.isCurrent()) {
        loadingOlder.current = false;
        setOlderPending(false);
      }
    }
  };
  return { ...query, loadOlder, olderPending, olderError };
}
