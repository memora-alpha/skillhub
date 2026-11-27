import { AppError } from "@/lib/http/errors";
import { UPLOAD_SCAN_TIMEOUT_MS } from "@/lib/http/watch-upload-status";
import type { ApiMessage, Delivery } from "../api/messages-api";
import type { ChatFile } from "../utils/chat-file";
import { OutboxState, type OutboxOptions } from "./outbox-state";
import type { QueuedText } from "./outbox-types";
import { AttachmentSendError } from "./attachment-errors";
import { AttachmentWait } from "./attachment-wait";
import { SentChatImages } from "./sent-chat-images";
import {
  prepareAttachment,
  type AttachmentFileApi,
} from "./attachment-preparation";
import {
  recoverAttachmentDelivery,
  waitForAttachmentDelivery,
} from "./attachment-delivery";
import { attachmentFailure, type AttachmentStage } from "./attachment-failure";

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
    private readonly fileApi: AttachmentFileApi,
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
    let stage: AttachmentStage = entry.phase === "check" ? "send" : "upload";
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
      // Reconcile the old command before considering another message POST.
      let result: Delivery | undefined = await recoverAttachmentDelivery(
        this.options.api,
        entry,
        control.signal,
        assertActive,
      );
      if (!result) {
        const fileId = await prepareAttachment({
          entry,
          api: this.fileApi,
          blob: this.blobs.get(id),
          signal: control.signal,
          current: () => this.current(epoch),
          active,
          assertActive,
          now: this.now,
          sleep: wait.wait,
          uploaded: async (attachment) => {
            this.update(id, { attachment });
            await this.persist();
          },
          checking: (fileId) => {
            this.observing = { fileId, wait };
            stage = "status";
          },
        });
        if (!fileId) return;
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
      const message = await waitForAttachmentDelivery(result, {
        api: this.options.api,
        entry,
        signal: control.signal,
        assertActive,
        sleep: wait.wait,
        processing: (messageId) =>
          this.update(id, { state: "processing", messageId }),
      });
      if (this.current(epoch)) await this.complete(id, message);
    } catch (cause) {
      if (!this.current(epoch)) return;
      this.update(id, attachmentFailure(cause, stage, timedOut, !active()));
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
  private async complete(id: string, message: ApiMessage) {
    const local = this.snapshot.items.find(
      (item) => item.clientMessageId === id,
    )?.attachment;
    const retained =
      message.senderId === this.options.ownerId &&
      local &&
      this.images.retain(message, local, this.cleanups.get(id));
    if (retained) this.cleanups.delete(id);
    this.update(id, {
      state: "sent",
      messageId: message.id,
      message,
      failure: undefined,
      failureCode: undefined,
    });
    this.blobs.delete(id);
    this.options.delivered(message);
    try {
      if (!retained) this.cleanups.get(id)?.();
    } catch {
      // Cache cleanup cannot undo confirmed delivery.
    }
    this.cleanups.delete(id);
    await this.persist().catch(() => {});
  }
}
