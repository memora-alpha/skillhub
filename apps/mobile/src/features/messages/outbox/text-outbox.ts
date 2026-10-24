import { AppError, errorMessage } from "@/lib/http/errors";
import { deliverQueuedText, retryableSend } from "./outbox-delivery";
import { OutboxState } from "./outbox-state";
import type { QueuedText } from "./outbox-types";
import { rateLimitUntil } from "@/lib/http/rate-limit";

export class TextOutbox extends OutboxState {
  private timer?: ReturnType<typeof setTimeout>;
  private abort?: AbortController;
  private online = true;
  private active = true;
  private busy = false;
  private epoch = 0;
  private limitedUntil = 0;
  async start() {
    this.stopped = false;
    const epoch = ++this.epoch;
    try {
      const items = await this.restore();
      if (!this.current(epoch)) return;
      this.snapshot = { ready: true, items };
      this.limitedUntil = Math.max(
        0,
        ...items.map((item) => item.rateLimitedUntil ?? 0),
      );
      this.publish(items);
      this.wake();
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
    clearTimeout(this.timer);
    this.abort?.abort();
  }
  private current(epoch: number) {
    return epoch === this.epoch && !this.stopped && this.options.current();
  }
  setConnection(online: boolean, active = true) {
    const reconnected = !this.online && online;
    this.online = online;
    this.active = active;
    if (reconnected)
      this.publish(
        this.snapshot.items.map((item) =>
          item.state === "queued"
            ? { ...item, retryAt: item.rateLimitedUntil ?? 0 }
            : item,
        ),
      );
    if (!online || !active) this.abort?.abort();
    this.wake();
  }
  private eligible() {
    const heads = new Set<string>();
    return this.snapshot.items.filter((item) => {
      if (item.state === "failed" || item.state === "sent") return false;
      if (heads.has(item.conversationId)) return false;
      heads.add(item.conversationId);
      return true;
    });
  }
  wake = () => {
    clearTimeout(this.timer);
    if (
      !this.snapshot.ready ||
      !this.current(this.epoch) ||
      !this.online ||
      !this.active ||
      this.busy
    )
      return;
    const heads = this.eligible();
    if (heads.length && this.limitedUntil > this.now()) {
      this.timer = setTimeout(this.wake, this.limitedUntil - this.now());
      return;
    }
    const item = heads.find((entry) => entry.retryAt <= this.now());
    if (item) {
      void this.run(item);
      return;
    }
    if (heads.length)
      this.timer = setTimeout(
        this.wake,
        Math.max(
          50,
          Math.min(...heads.map((entry) => entry.retryAt)) - this.now(),
        ),
      );
  };
  private async run(item: QueuedText) {
    this.busy = true;
    const epoch = this.epoch;
    const control = new AbortController();
    this.abort = control;
    const id = item.clientMessageId;
    this.update(id, {
      state: item.phase === "send" ? "sending" : "processing",
      attempts: item.attempts + 1,
    });
    try {
      // Persist reconciliation intent before POST, so a lost response cannot
      // turn into a second logical message after a restart.
      this.update(id, { phase: "check" });
      try {
        await this.persist();
      } catch {
        throw new AppError("storage");
      }
      if (!this.current(epoch) || !this.online || !this.active) return;
      const result = await deliverQueuedText(
        this.options.api,
        item,
        control.signal,
      );
      if (!this.current(epoch)) return;
      if (result.deliveryStatus === "DELIVERED") {
        this.update(id, {
          state: "sent",
          messageId: result.message.id,
          message: result.message,
          failure: undefined,
        });
        this.options.delivered(result.message);
      } else
        this.update(id, {
          state: "processing",
          messageId: result.messageId,
          retryAt:
            this.now() +
            Math.min(30000, 2000 * 2 ** Math.min(item.attempts, 4)),
        });
      // A failed cleanup write must not undo a server-confirmed delivery. The
      // persisted client ID can safely reconcile that delivery on next launch.
      await this.persist().catch(() => {});
    } catch (error) {
      await this.failDelivery(item, control, epoch, error);
    } finally {
      this.busy = false;
      if (this.abort === control) this.abort = undefined;
      this.wake();
    }
  }
  private async failDelivery(
    item: QueuedText,
    control: AbortController,
    epoch: number,
    error: unknown,
  ) {
    const id = item.clientMessageId;
    if (
      !this.current(epoch) ||
      this.snapshot.items.find((entry) => entry.clientMessageId === id)
        ?.state === "sent"
    )
      return;
    const retry = control.signal.aborted || retryableSend(error);
    const rateLimitedUntil = rateLimitUntil(error, this.now());
    if (rateLimitedUntil)
      this.limitedUntil = Math.max(this.limitedUntil, rateLimitedUntil);
    let failure: string | undefined;
    if (!retry)
      failure =
        error instanceof AppError && error.kind === "storage"
          ? "Chưa lưu được tin nhắn. Thử lại."
          : errorMessage(error);
    this.update(id, {
      state: retry ? "queued" : "failed",
      failure,
      rateLimitedUntil: rateLimitedUntil || item.rateLimitedUntil,
      retryAt: Math.max(
        rateLimitedUntil,
        this.now() + Math.min(30000, 1000 * 2 ** Math.min(item.attempts, 5)),
      ),
    });
    await this.persist().catch(() =>
      this.update(id, {
        state: "failed",
        failure: "Chưa lưu được tin nhắn. Thử lại.",
      }),
    );
  }
}
