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
import type { ApiMessage } from "../api/messages-api";
import { useMessagesApi } from "../hooks/use-messages-api";
import { TextOutbox } from "../outbox/text-outbox";
import { AttachmentOutbox } from "../outbox/attachment-outbox";
import { useChatEvents } from "./ChatEvents";
import type { ChatFile } from "../utils/chat-file";
import { createOutboxStorage } from "../outbox/outbox-storage";
import type { OutboxSnapshot } from "../outbox/outbox-types";
import { rememberDeliveredMessage } from "../utils/conversation-preview";
import { attachmentEventWake } from "../utils/attachment-event-wake";

type ContextValue = OutboxSnapshot & {
  store: TextOutbox;
  attachmentStore: AttachmentOutbox;
  attachmentReady: boolean;
  offline: boolean;
};
const Context = createContext<ContextValue | null>(null);
export function ChatOutboxProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  const runtime = useConnections(),
    api = useMessagesApi(),
    cache = useQueryClient();
  const network = useNetworkState();
  const events = useChatEvents();
  const offline = deviceOffline(network);
  const configuration = useMemo(() => {
    try {
      return { scope: getApiUrl(), error: undefined };
    } catch {
      return { scope: null, error: new AppError("config") };
    }
  }, []);
  const scope = configuration.scope;
  const stores = useMemo(() => {
    const options = {
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
      delivered: (message: ApiMessage) => {
        if (!runtime.isCurrent()) return;
        rememberDeliveredMessage(cache, runtime.key, message);
        // The confirmed message already updates the thread and its preview.
        // SSE owns subsequent peer changes; do not reload every inbox row.
        if (connectionStore.getSnapshot().reason === "unreachable") {
          const ticket = connectionStore.beginRetry();
          if (ticket !== null) connectionStore.finishRetry(ticket, true);
        }
      },
    };
    return {
      text: new TextOutbox(options),
      attachments: new AttachmentOutbox(
        {
          ...options,
          storage: scope
            ? createOutboxStorage(runtime.userId ?? "", scope, "attachments")
            : options.storage,
        },
        api,
      ),
    };
  }, [runtime, api, cache, scope, configuration.error]);
  const { text: store, attachments: attachmentStore } = stores;
  useEffect(
    () =>
      cache.getQueryCache().subscribe(({ query }) => {
        if (!runtime.key.every((part, index) => query.queryKey[index] === part))
          return;
        const kind = query.queryKey[runtime.key.length];
        if (kind === "thread") {
          const data = cache.getQueryData<{ messages: ApiMessage[] }>(
            query.queryKey,
          );
          attachmentStore.images.reconcile(data?.messages ?? []);
        } else if (kind === "conversation-preview") {
          const message = cache.getQueryData<ApiMessage>(query.queryKey);
          if (message) attachmentStore.images.reconcile([message]);
        }
      }),
    [cache, runtime.key, attachmentStore],
  );
  const snapshot = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );
  const attachments = useSyncExternalStore(
    attachmentStore.subscribe,
    attachmentStore.getSnapshot,
    attachmentStore.getSnapshot,
  );
  useEffect(() => {
    if (scope && runtime.enabled && runtime.userId) {
      void store.start();
      void attachmentStore.start();
    }
    return () => {
      store.stop();
      attachmentStore.stop();
    };
  }, [store, attachmentStore, runtime.enabled, runtime.userId, scope]);
  useEffect(() => {
    store.setConnection(!offline, AppState.currentState !== "background");
    attachmentStore.setConnection(!offline, AppState.currentState === "active");
    const listener = AppState.addEventListener("change", (state) => {
      store.setConnection(!offline, state === "active");
      attachmentStore.setConnection(!offline, state === "active");
    });
    return () => listener.remove();
  }, [store, attachmentStore, offline]);
  useEffect(
    () =>
      events.subscribe((frame, signal) => {
        if (signal.aborted || !runtime.isCurrent()) return;
        const wake = attachmentEventWake(frame);
        if (wake) attachmentStore.refresh(wake.fileId);
      }),
    [events.subscribe, attachmentStore, runtime],
  );
  const value = useMemo(
    () => ({
      ...snapshot,
      items: [...snapshot.items, ...attachments.items].sort(
        (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt),
      ),
      error: configuration.error ?? snapshot.error ?? attachments.error,
      store,
      attachmentStore,
      attachmentReady: attachments.ready,
      offline,
    }),
    [
      snapshot,
      attachments,
      configuration.error,
      store,
      attachmentStore,
      offline,
    ],
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
export function useSentChatImages() {
  return useOutboxContext().attachmentStore.images;
}
export function useChatOutbox(id: string) {
  const context = useOutboxContext();
  return {
    ...context,
    items: context.items.filter((item) => item.conversationId === id),
    send: (text: string) => context.store.enqueue(id, text),
    sendAttachment: (text: string, file: ChatFile) =>
      context.attachmentStore.enqueue(id, text, file),
    retry: (clientId: string) => {
      if (
        context.attachmentStore
          .getSnapshot()
          .items.some((item) => item.clientMessageId === clientId)
      )
        context.attachmentStore.retry(clientId);
      else context.store.retry(clientId);
    },
    reconcile: (ids: readonly string[]) => {
      context.store.reconcile(ids);
      context.attachmentStore.reconcile(ids);
    },
  };
}
