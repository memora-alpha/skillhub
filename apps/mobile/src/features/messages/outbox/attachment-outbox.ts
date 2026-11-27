import { AppError, errorMessage } from "@/lib/http/errors";
import { filePickerError } from "@/lib/http/file-picker-error";
import { UPLOAD_SCAN_TIMEOUT_MS } from "@/lib/http/watch-upload-status";
import { waitForChatAttachment } from "./watch-chat-attachment";
import type { createMessagesApi, Delivery } from "../api/messages-api";
import { chatFileFormData, type ChatFile } from "../utils/chat-file";
import { OutboxState, type OutboxOptions } from "./outbox-state";
import type { QueuedText } from "./outbox-types";
import {
  AttachmentSendError,
  requireReadyAttachment,
} from "./attachment-errors";
import { AttachmentWait } from "./attachment-wait";
import { SentChatImages } from "./sent-chat-images";
import { retryChatAttachment } from "../utils/retry-chat-attachment";

type FileApi = Pick<
  ReturnType<typeof createMessagesApi>,
  "upload" | "fileStatus" | "retryAttachment"
>;

// Separate from the text worker: slow OCR must not hold up ordinary messages.
export class AttachmentOutbox extends OutboxState {
  readonly images = new SentChatImages();
  private online = true;
  private active = true;
  private busy = false;
  private epoch = 0;
  private abort?: AbortController;
  private observing?: { fileId?: string; wait: AttachmentWait };
  private readonly blobs = new Map<string, File>();
  private readonly cleanups = new Map<string, () => void>();
  constructor(
    options: OutboxOptions,
    private readonly fileApi: FileApi,
  ) {
    super(options);
  }
  private current(epoch: number) {
    return epoch === this.epoch && !this.stopped && this.options.current();
  }
  async start() {
    this.stopped = false;
    const epoch = ++this.epoch;
    try {
      const items = await this.restore();
      if (!this.current(epoch)) return;
      this.snapshot = { ready: true, items };
      this.publish(items);
    } catch {
      if (this.current(epoch))
        this.publish(
          [],
          new AppError("storage", 0, "CHAT_OUTBOX_STORAGE_UNAVAILABLE"),
        );
    }
  }
  stop() {
    this.epoch++;
    this.stopped = true;
    this.abort?.abort();
    this.images.clear();
    for (const [id, cleanup] of this.cleanups) {
      if (this.blobs.has(id)) {
        try {
          cleanup();
        } catch {
          /* Release web object URLs when their owner leaves. */
        }
      }
    }
    this.blobs.clear();
    // Persisted pending uploads may still need their local files after restart.
    this.cleanups.clear();
  }
  setConnection(online: boolean, active = true) {
    this.online = online;
    this.active = active;
    if (!online || !active) {
      this.abort?.abort();
      this.publish(
        this.snapshot.items.map((item) =>
          item.state === "sent" || item.state === "failed"
            ? item
            : {
                ...item,
                state: "failed",
                failureCode: "CHAT_ATTACHMENT_INTERRUPTED",
                failure: "Lần gửi tệp bị gián đoạn. Bấm Thử lại để tiếp tục.",
              },
        ),
      );
      if (this.snapshot.ready) void this.persist().catch(() => {});
    }
    // Resuming the app/network never replays a file upload or message POST.
    this.wake();
  }
  override enqueue(conversationId: string, text: string, file?: ChatFile) {
    if (!file || !this.online || !this.active) return false;
    const accepted = super.enqueue(conversationId, text, file);
    const entry = this.snapshot.items.at(-1);
    if (accepted && entry && file.file)
      this.blobs.set(entry.clientMessageId, file.file);
    if (accepted && entry && file.cleanup)
      this.cleanups.set(entry.clientMessageId, file.cleanup);
    return accepted;
  }
  refresh(fileId?: string) {
    if (!fileId || this.observing?.fileId === fileId)
      this.observing?.wait.notify();
  }
  protected override canRetry() {
    return this.online && this.active && this.snapshot.ready;
  }
  wake = () => {
    if (
      !this.snapshot.ready ||
      !this.current(this.epoch) ||
      !this.online ||
      !this.active ||
      this.busy
    )
      return;
    const entry = this.snapshot.items.find((item) => item.state === "queued");
    if (entry) void this.run(entry);
  };
  private async run(entry: QueuedText) {
    this.busy = true;
    const epoch = this.epoch,
      control = new AbortController(),
      wait = new AttachmentWait();
    const id = entry.clientMessageId;
    let timedOut = false;
    let stage: "upload" | "status" | "send" =
      entry.phase === "check" ? "send" : "upload";
    this.abort = control;
    this.observing = { fileId: entry.attachment?.fileId, wait };
    const active = () =>
      this.current(epoch) &&
      this.online &&
      this.active &&
      !control.signal.aborted &&
      this.snapshot.items.find((item) => item.clientMessageId === id)?.state !==
        "failed";
    const assertActive = () => {
      if (!active())
        throw new AttachmentSendError(
          "Lần gửi tệp bị gián đoạn. Bấm Thử lại để tiếp tục.",
          "CHAT_ATTACHMENT_INTERRUPTED",
        );
    };
    const deadline = setTimeout(() => {
      timedOut = true;
      control.abort();
    }, UPLOAD_SCAN_TIMEOUT_MS);
    this.update(id, {
      state: "sending",
      failure: undefined,
      failureCode: undefined,
      attempts: entry.attempts + 1,
    });
    try {
      await this.persist();
      assertActive();
      // A manual retry reconciles the old identity before considering another POST.
      let result: Delivery | undefined;
      if (entry.phase === "check") {
        try {
          result = await this.options.api.delivery(
            entry.conversationId,
            id,
            control.signal,
          );
        } catch (error) {
          if (!(error instanceof AppError && error.status === 404)) throw error;
        }
        assertActive();
        if (
          result &&
          result.deliveryStatus !== "DELIVERED" &&
          (result.deliveryStatus === "PREPARING" || result.failureCode)
        )
          result = undefined;
      }
      if (!result) {
        let attachment = entry.attachment;
        if (!attachment) throw new AppError("protocol");
        if (!attachment.fileId) {
          const blob = this.blobs.get(id);
          if (!blob && attachment.uri.startsWith("blob:"))
            throw new AttachmentSendError(
              "Không còn đọc được tệp gốc. Hãy chọn lại tệp để gửi.",
              "CHAT_FILE_UNAVAILABLE",
            );
          assertActive();
          const uploaded = await this.fileApi.upload(
            entry.conversationId,
            chatFileFormData({ ...attachment, file: blob }),
            control.signal,
            `chat-upload:${id}`,
          );
          // Preserve an acknowledged upload even if the app just went inactive;
          // the pause still prevents status work and POST until manual recovery.
          if (!this.current(epoch)) return;
          attachment = { ...attachment, fileId: uploaded.fileId };
          this.update(id, { attachment });
          await this.persist();
          assertActive();
        }
        const fileId = attachment.fileId!;
        this.observing.fileId = fileId;
        stage = "status";
        if (entry.attempts > 0) {
          await retryChatAttachment({
            read: () =>
              this.fileApi.fileStatus(
                entry.conversationId,
                fileId,
                control.signal,
              ),
            retry: () =>
              this.fileApi.retryAttachment(
                entry.conversationId,
                fileId,
                control.signal,
              ),
            current: active,
          });
          assertActive();
        }
        await waitForChatAttachment({
          read: (signal) =>
            this.fileApi.fileStatus(entry.conversationId, fileId, signal),
          active,
          signal: control.signal,
          sleep: wait.wait,
          now: this.now,
        });
        assertActive();
        // Rules may change while the file was waiting. Fresh HTTP still gates POST.
        requireReadyAttachment(
          await this.fileApi.fileStatus(
            entry.conversationId,
            fileId,
            control.signal,
          ),
        );
        assertActive();
        this.update(id, { phase: "check" });
        await this.persist();
        assertActive();
        stage = "send";
        result = await this.options.api.send(
          entry.conversationId,
          {
            clientMessageId: id,
            messageText: entry.messageText,
            attachmentFileIds: [fileId],
          },
          control.signal,
        );
      }
      while (result.deliveryStatus !== "DELIVERED") {
        assertActive();
        if (result.failureCode)
          throw new AppError("http", 409, result.failureCode);
        this.update(id, { state: "processing", messageId: result.messageId });
        await wait.wait(2000, control.signal);
        assertActive();
        result = await this.options.api.delivery(
          entry.conversationId,
          id,
          control.signal,
        );
      }
      if (!this.current(epoch)) return;
      const local = this.snapshot.items.find(
        (item) => item.clientMessageId === id,
      )?.attachment;
      const retained =
        result.message.senderId === this.options.ownerId &&
        local &&
        this.images.retain(result.message, local, this.cleanups.get(id));
      if (retained) this.cleanups.delete(id);
      this.update(id, {
        state: "sent",
        messageId: result.message.id,
        message: result.message,
        failure: undefined,
        failureCode: undefined,
      });
      this.blobs.delete(id);
      this.options.delivered(result.message);
      try {
        if (!retained) this.cleanups.get(id)?.();
      } catch {
        /* A cache cleanup cannot undo delivery. */
      }
      this.cleanups.delete(id);
      await this.persist().catch(() => {});
    } catch (cause) {
      if (!this.current(epoch)) return;
      const restartRequired =
        cause instanceof AppError &&
        ["CHAT_UPLOAD_KEY_CONFLICT", "CHAT_UPLOAD_RESTART_REQUIRED"].includes(
          cause.code ?? "",
        );
      const error = restartRequired
        ? new AttachmentSendError(
            "Không thể tiếp tục lần tải này. Chọn lại tệp.",
            "CHAT_FILE_UPLOAD_RESTART_REQUIRED",
          )
        : cause;
      const interrupted = !active();
      this.update(id, {
        state: "failed",
        failureCode: timedOut
          ? "CHAT_ATTACHMENT_TIMEOUT"
          : interrupted
            ? "CHAT_ATTACHMENT_INTERRUPTED"
            : error instanceof AppError || error instanceof AttachmentSendError
              ? error.code
              : undefined,
        failure: timedOut
          ? "Tệp chưa gửi xong. Bấm Thử lại để kiểm tra tiếp."
          : interrupted
            ? "Lần gửi tệp bị gián đoạn. Bấm Thử lại để tiếp tục."
            : error instanceof AttachmentSendError
              ? error.message
              : stage === "send"
                ? errorMessage(error)
                : filePickerError(error, stage),
      });
      await this.persist().catch(() =>
        this.update(id, {
          state: "failed",
          failure: "Chưa lưu được lần gửi tệp. Bấm Thử lại.",
        }),
      );
    } finally {
      clearTimeout(deadline);
      if (this.abort === control) {
        this.abort = undefined;
        this.observing = undefined;
      }
      this.busy = false;
      this.wake();
    }
  }
}
