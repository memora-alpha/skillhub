import { useCallback, useMemo, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { AppError } from "@/lib/http/errors";
import { connectionReadAccess } from "@/lib/http/read-access";
import { uuid } from "@/lib/http/contracts";
import {
  useConnections,
  useConnectionList,
  useConnectionQuery,
} from "@/features/connections";
import { createMessagesApi, mergeMessages } from "../api/messages-api";
import {
  readThreadSnapshot,
  type ThreadSnapshot as Thread,
} from "../utils/thread-snapshot";

export function useMessagesApi() {
  const { call, userId } = useConnections();
  return useMemo(() => createMessagesApi(call, userId ?? ""), [call, userId]);
}
export function useConversations() {
  const api = useMessagesApi();
  return useConnectionList(
    ["conversations"],
    (cursor, signal) => api.list(cursor, signal),
    true,
    { refreshOnFocus: "stale" },
  );
}
export function useConversation(id: string) {
  const api = useMessagesApi();
  return useConnectionQuery(
    ["conversation", id],
    (signal) => api.detail(id, signal),
    uuid.safeParse(id).success,
    { refreshOnFocus: "stale" },
  );
}
export function useThread(id: string, enabled: boolean) {
  const api = useMessagesApi(),
    runtime = useConnections(),
    cache = useQueryClient();
  const key = [...runtime.key, "thread", id];
  const loadingOlder = useRef(false);
  const fresh = useRef(true);
  const olderRequest = useRef<AbortController | undefined>(undefined);
  useFocusEffect(
    useCallback(() => {
      fresh.current =
        cache.getQueryCache().find({ queryKey: key, exact: true })?.isStale() ??
        true;
      loadingOlder.current = false;
      setOlderPending(false);
      return () => {
        fresh.current = true;
        olderRequest.current?.abort();
      };
    }, [id, cache, runtime.key]),
  );
  const [olderPending, setOlderPending] = useState(false);
  const [olderError, setOlderError] = useState<unknown>();
  const query = useConnectionQuery<Thread>(
    ["thread", id],
    async (signal) => {
      const previous = cache.getQueryData<Thread>(key);
      const receiptRevision =
        cache.getQueryData<number>([...runtime.key, "thread-receipts", id]) ??
        0;
      const latestOnly = fresh.current;
      fresh.current = false;
      return readThreadSnapshot(api, id, {
        signal,
        latestOnly,
        previous,
        receiptRevision,
        userId: runtime.userId,
        current: () => cache.getQueryData<Thread>(key),
        assertCurrent: runtime.assertCurrent,
      });
    },
    enabled && uuid.safeParse(id).success,
    { refreshOnFocus: "stale" },
  );
  const loadOlder = async () => {
    const previous = query.data;
    if (!previous?.nextCursor || query.isFetching || loadingOlder.current)
      return;
    loadingOlder.current = true;
    setOlderPending(true);
    setOlderError(undefined);
    const controller = new AbortController();
    olderRequest.current = controller;
    try {
      const page = await connectionReadAccess(cache, key).read(
        () =>
          api.history(id, {
            cursor: previous.nextCursor!,
            signal: controller.signal,
          }),
        runtime.isCurrent,
      );
      runtime.assertCurrent();
      if (page.hasMore && page.nextCursor === previous.nextCursor)
        throw new AppError("protocol");
      if (controller.signal.aborted) return;
      cache.setQueryData<Thread>(key, (current) =>
        !current || current.nextCursor !== previous.nextCursor
          ? current
          : {
              ...current,
              messages: mergeMessages(page.items, current.messages),
              nextCursor: page.nextCursor,
            },
      );
    } catch (error) {
      if (runtime.isCurrent() && !controller.signal.aborted)
        setOlderError(error);
    } finally {
      if (runtime.isCurrent() && olderRequest.current === controller) {
        loadingOlder.current = false;
        setOlderPending(false);
      }
    }
  };
  return { ...query, loadOlder, olderPending, olderError };
}
