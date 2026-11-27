import { AppError } from "@/lib/http/errors";
import type { createMessagesApi } from "../api/messages-api";
import { chatFileFormData } from "../utils/chat-file";
import { retryChatAttachment } from "../utils/retry-chat-attachment";
import type { QueuedText } from "./outbox-types";
import {
  AttachmentSendError,
  requireReadyAttachment,
} from "./attachment-errors";
import { waitForChatAttachment } from "./watch-chat-attachment";

export type AttachmentFileApi = Pick<
  ReturnType<typeof createMessagesApi>,
  "upload" | "fileStatus" | "retryAttachment"
>;

export async function prepareAttachment(options: {
  entry: QueuedText;
  blob?: File;
  api: AttachmentFileApi;
  signal: AbortSignal;
  current(): boolean;
  active(): boolean;
  assertActive(): void;
  now(): number;
  sleep(ms: number, signal: AbortSignal): Promise<void>;
  uploaded(attachment: NonNullable<QueuedText["attachment"]>): Promise<void>;
  checking(fileId: string): void;
}) {
  const { entry, api, signal, assertActive } = options;
  let attachment = entry.attachment;
  if (!attachment) throw new AppError("protocol");
  if (!attachment.fileId) {
    if (!options.blob && attachment.uri.startsWith("blob:"))
      throw new AttachmentSendError(
        "Không còn đọc được tệp gốc. Hãy chọn lại tệp để gửi.",
        "CHAT_FILE_UNAVAILABLE",
      );
    assertActive();
    const uploaded = await api.upload(
      entry.conversationId,
      chatFileFormData({ ...attachment, file: options.blob }),
      signal,
      `chat-upload:${entry.clientMessageId}`,
    );
    // Keep an acknowledged file ID after pausing, but never POST a message until manual recovery.
    if (!options.current()) return;
    attachment = { ...attachment, fileId: uploaded.fileId };
    await options.uploaded(attachment);
    assertActive();
  }
  const fileId = attachment.fileId!;
  options.checking(fileId);
  if (entry.attempts > 0) {
    await retryChatAttachment({
      read: () => api.fileStatus(entry.conversationId, fileId, signal),
      retry: () => api.retryAttachment(entry.conversationId, fileId, signal),
      current: options.active,
    });
    assertActive();
  }
  await waitForChatAttachment({
    read: (readSignal) =>
      api.fileStatus(entry.conversationId, fileId, readSignal),
    active: options.active,
    signal,
    sleep: options.sleep,
    now: options.now,
  });
  assertActive();
  // A new policy may take effect while waiting. Only a fresh HTTP result gates publication.
  requireReadyAttachment(
    await api.fileStatus(entry.conversationId, fileId, signal),
  );
  assertActive();
  return fileId;
}
