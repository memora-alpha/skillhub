import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { AppState } from "react-native";
import { randomUUID } from "expo-crypto";
import { useNetworkState } from "expo-network";
import { useQueryClient } from "@tanstack/react-query";
import { getApiUrl } from "@/config/env";
import { AppError } from "@/lib/http/errors";
import { useConnections } from "@/features/connections";
import { connectionStore, deviceOffline } from "@/lib/network/connection-store";
import { mergeMessages, type ApiMessage } from "../api/messages-api";
import { useMessagesApi } from "../hooks/use-messages-api";
import { TextOutbox } from "../outbox/text-outbox";
import { createOutboxStorage } from "../outbox/outbox-storage";
import type { OutboxSnapshot } from "../outbox/outbox-types";
import { rememberLatestMessage } from "../utils/conversation-preview";

type ContextValue = OutboxSnapshot & { store: TextOutbox; offline: boolean };
const Context = createContext<ContextValue | null>(null);
export function ChatOutboxProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  const runtime = useConnections(),
    api = useMessagesApi(),
    cache = useQueryClient();
  const network = useNetworkState();
  const offline = deviceOffline(network);
  const configuration = useMemo(() => {
    try {
      return { scope: getApiUrl(), error: undefined };
    } catch {
      return { scope: null, error: new AppError("config") };
    }
  }, []);
  const scope = configuration.scope;
  const store = useMemo(
    () =>
      new TextOutbox({
        ownerId: runtime.userId ?? "",
        scope: scope ?? "",
        storage: scope
          ? createOutboxStorage(runtime.userId ?? "", scope)
          : {
              read: () => Promise.resolve(null),
              write: () => Promise.reject(configuration.error),
            },
        api,
        current: () => scope !== null && runtime.isCurrent(),
        createId: randomUUID,
        delivered: (message) => {
          if (!runtime.isCurrent()) return;
          rememberLatestMessage(cache, runtime.key, message);
          const key = [...runtime.key, "thread", message.conversationId];
          // Do not seed a partial history or invent a history cursor.
          cache.setQueryData<{
            messages: ApiMessage[];
            nextCursor: string | null;
          }>(key, (previous) =>
            previous
              ? {
                  ...previous,
                  messages: mergeMessages(previous.messages, [message]),
                }
              : undefined,
          );
          void cache.invalidateQueries({
            queryKey: [...runtime.key, "conversations"],
          });
          void cache.invalidateQueries({ queryKey: key });
          if (connectionStore.getSnapshot().reason === "unreachable") {
            const ticket = connectionStore.beginRetry();
            if (ticket !== null) connectionStore.finishRetry(ticket, true);
          }
        },
      }),
    [runtime, api, cache, scope, configuration.error],
  );
  const snapshot = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );
  useEffect(() => {
    if (scope && runtime.enabled && runtime.userId) void store.start();
    return () => store.stop();
  }, [store, runtime.enabled, runtime.userId, scope]);
  useEffect(() => {
    store.setConnection(!offline, AppState.currentState !== "background");
    const listener = AppState.addEventListener("change", (state) =>
      store.setConnection(!offline, state === "active"),
    );
    return () => listener.remove();
  }, [store, offline]);
  const value = useMemo(
    () => ({
      ...snapshot,
      error: configuration.error ?? snapshot.error,
      store,
      offline,
    }),
    [snapshot, configuration.error, store, offline],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
function useOutboxContext() {
  const context = useContext(Context);
  if (!context) throw new Error("ChatOutboxProvider missing");
  return context;
}
export function useChatOutboxEntries() {
  return useOutboxContext().items;
}
export function useChatOutbox(id: string) {
  const context = useOutboxContext();
  return {
    ...context,
    items: context.items.filter((item) => item.conversationId === id),
    send: (text: string) => context.store.enqueue(id, text),
    retry: context.store.retry,
    reconcile: context.store.reconcile,
  };
}
