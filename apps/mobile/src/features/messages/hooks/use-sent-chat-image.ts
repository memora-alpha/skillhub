import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useConnections } from "@/features/connections";
import type { ApiMessage } from "../api/messages-api";
import { useChatOutboxEntries, useSentChatImages } from "../context/ChatOutbox";
import { isFinalAttachmentFailure } from "../outbox/attachment-errors";
import { isContentRejection } from "../utils/chat-send-notice";
import {
  isSentImageRestricted,
  sentImageKey,
} from "../outbox/sent-chat-images";

export function useSentChatImage(
  message: ApiMessage,
  file: ApiMessage["attachments"][number],
) {
  const store = useSentChatImages();
  const entries = useChatOutboxEntries();
  const runtime = useConnections();
  const key = sentImageKey(message, file);
  const uri = useSyncExternalStore(
    store.subscribe,
    () => store.get(key),
    () => undefined,
  );
  // SSE may publish the message before the sender receives its POST receipt.
  const inFlight = entries.find(
    (entry) =>
      entry.conversationId === message.conversationId &&
      entry.attachment?.fileId === file.fileId &&
      !(
        entry.state === "failed" &&
        (isFinalAttachmentFailure(entry.failureCode) ||
          isContentRejection(entry.failureCode))
      ),
  );
  const allowed =
    runtime.isCurrent() &&
    message.senderId === runtime.userId &&
    !isSentImageRestricted(file);
  const release = useCallback(() => store.remove(key), [store, key]);
  useEffect(() => {
    if (!allowed) store.remove(key);
  }, [allowed, store, key]);
  return {
    uri: allowed ? (uri ?? inFlight?.attachment?.uri) : undefined,
    release,
  };
}
