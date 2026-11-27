import type { ApiMessage } from "../api/messages-api";
import type { ChatFile } from "../utils/chat-file";
import { isChatImage } from "../utils/chat-attachment-kind";

export function sentImageKey(
  message: ApiMessage,
  file: ApiMessage["attachments"][number],
) {
  return JSON.stringify([
    message.conversationId,
    message.id,
    file.attachmentId,
    file.fileId,
  ]);
}

export function isSentImageRestricted(file: ApiMessage["attachments"][number]) {
  const access = file.accessStatus ?? file.availability;
  return (
    access === "REVOKED" ||
    access === "UNAVAILABLE" ||
    ["BLOCKED", "REVIEW_REQUIRED", "FAILED"].includes(
      file.moderationStatus ?? "",
    )
  );
}

// Session-only handoff: a delivery receipt must not dispose pixels still on screen.
// This store is deliberately independent of persisted/reconciled outbox entries.
export class SentChatImages {
  private readonly files = new Map<
    string,
    { uri: string; cleanup?: () => void }
  >();
  private readonly listeners = new Set<() => void>();
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  get = (key: string) => this.files.get(key)?.uri;
  retain(
    message: ApiMessage,
    local: ChatFile & { fileId?: string },
    cleanup?: () => void,
  ) {
    const file = message.attachments.find(
      (file) => file.fileId === local.fileId,
    );
    if (
      !file ||
      !isChatImage(file.mimeType) ||
      !isChatImage(local.mimeType) ||
      isSentImageRestricted(file)
    )
      return false;
    const key = sentImageKey(message, file);
    if (this.files.has(key)) this.remove(key);
    this.files.set(key, { uri: local.uri, cleanup });
    // Bound native cache ownership even when many pending cards never mount.
    while (this.files.size > 32) this.remove(this.files.keys().next().value!);
    this.listeners.forEach((listener) => listener());
    return true;
  }
  remove = (key: string) => {
    const file = this.files.get(key);
    if (!file) return;
    this.files.delete(key);
    try {
      file.cleanup?.();
    } catch {
      /* Cleanup cannot undo confirmed delivery. */
    }
    this.listeners.forEach((listener) => listener());
  };
  reconcile(messages: readonly ApiMessage[]) {
    for (const message of messages)
      for (const file of message.attachments)
        if (isSentImageRestricted(file))
          this.remove(sentImageKey(message, file));
  }
  clear() {
    for (const key of this.files.keys()) this.remove(key);
  }
}
