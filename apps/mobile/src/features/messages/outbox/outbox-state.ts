import { AppError } from "@/lib/http/errors";
import { parse } from "@/lib/http/contracts";
import type { ApiMessage } from "../api/messages-api";
import type { OutboxApi } from "./outbox-delivery";
import {
  queuedTextSchema,
  savedOutboxSchema,
  type QueuedText,
  type OutboxStorage,
  type OutboxSnapshot,
} from "./outbox-types";

export type OutboxOptions = {
  ownerId: string;
  scope: string;
  storage: OutboxStorage;
  api: OutboxApi;
  current(): boolean;
  createId(): string;
  now?: () => number;
  delivered(message: ApiMessage): void;
};
export abstract class OutboxState {
  protected snapshot: OutboxSnapshot = { ready: false, items: [] };
  protected stopped = true;
  protected now: () => number;
  private listeners = new Set<() => void>();
  private writes: Promise<void> = Promise.resolve();
  constructor(protected options: OutboxOptions) {
    this.now = options.now ?? Date.now;
  }
  abstract wake(): void;
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  protected publish(items: QueuedText[], error = this.snapshot.error) {
    this.snapshot = { ...this.snapshot, items, error };
    this.listeners.forEach((listener) => listener());
  }
  protected update(id: string, patch: Partial<QueuedText>) {
    this.publish(
      this.snapshot.items.map((item) =>
        item.clientMessageId === id ? { ...item, ...patch } : item,
      ),
    );
  }
  protected persist() {
    const raw = JSON.stringify({
      version: 1,
      ownerId: this.options.ownerId,
      scope: this.options.scope,
      items: this.snapshot.items.filter((item) => item.state !== "sent"),
    });
    const next = this.writes.then(
      () => this.options.storage.write(raw),
      () => this.options.storage.write(raw),
    );
    this.writes = next.catch(() => {});
    return next;
  }
  protected async restore() {
    const raw = await this.options.storage.read();
    const saved = raw ? parse(savedOutboxSchema, JSON.parse(raw)) : null;
    if (
      saved &&
      (saved.ownerId !== this.options.ownerId ||
        saved.scope !== this.options.scope)
    )
      throw new AppError("storage");
    return (saved?.items ?? []).map((item): QueuedText => ({
      ...item,
      state: item.state === "failed" ? "failed" : "queued",
      retryAt: 0,
    }));
  }
  enqueue(conversationId: string, messageText: string) {
    if (!this.snapshot.ready || !this.options.current() || this.stopped)
      return false;
    const body = queuedTextSchema.safeParse({
      clientMessageId: this.options.createId(),
      conversationId,
      messageText: messageText.trim(),
      createdAt: new Date(this.now()).toISOString(),
      state: "queued",
      phase: "send",
      attempts: 0,
      retryAt: 0,
    });
    if (!body.success) return false;
    this.publish([...this.snapshot.items, body.data]);
    void this.persist()
      .then(() => this.wake())
      .catch(() => {
        if (!this.stopped && this.options.current())
          this.update(body.data.clientMessageId, {
            state: "failed",
            failure: "Chưa lưu được tin nhắn. Thử lại.",
          });
      });
    return true;
  }
  retry = (id: string) => {
    const item = this.snapshot.items.find(
      (entry) => entry.clientMessageId === id,
    );
    if (
      !item ||
      item.state !== "failed" ||
      !this.options.current() ||
      this.stopped
    )
      return;
    this.update(id, { state: "queued", retryAt: 0, failure: undefined });
    void this.persist()
      .then(() => this.wake())
      .catch(() => {
        if (!this.stopped && this.options.current())
          this.update(id, {
            state: "failed",
            failure: "Chưa lưu được tin nhắn. Thử lại.",
          });
      });
  };
  reconcile = (ids: readonly string[]) => {
    const known = new Set(ids);
    const items = this.snapshot.items.filter(
      (item) =>
        !(item.state === "sent" && item.messageId && known.has(item.messageId)),
    );
    if (items.length !== this.snapshot.items.length) this.publish(items);
  };
}
