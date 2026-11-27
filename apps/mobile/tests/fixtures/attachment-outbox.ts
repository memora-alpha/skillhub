import assert from "node:assert/strict";
import { AttachmentOutbox } from "../../src/features/messages/outbox/attachment-outbox";
import type { OutboxOptions } from "../../src/features/messages/outbox/outbox-state";
import type {
  createMessagesApi,
  Delivery,
  MessageDraft,
} from "../../src/features/messages/api/messages-api";
import { fixtureId } from "./learning-requests-data";

export const file = {
  name: "lesson.pdf",
  uri: "file:///lesson.pdf",
  mimeType: "application/pdf",
  size: 100,
};
export const delivered: Delivery = {
  deliveryStatus: "DELIVERED",
  message: {
    id: fixtureId(70),
    conversationId: fixtureId(10),
    senderId: fixtureId(1),
    messageType: "FILE",
    messageText: "caption",
    sequence: "1",
    sentAt: "2026-11-24T00:00:00Z",
    readAt: null,
    attachments: [
      {
        attachmentId: fixtureId(60),
        fileId: fixtureId(40),
        filename: file.name,
        mimeType: file.mimeType,
        fileSizeBytes: file.size,
        downloadUrlEndpoint: "/fixture",
      },
    ],
  },
};
export const flush = () =>
  new Promise<void>((resolve) => setImmediate(resolve));
export async function until(done: () => boolean) {
  for (let i = 0; i < 30 && !done(); i++) await flush();
  assert.ok(done(), "operation did not settle");
}
export function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((finish) => {
    resolve = finish;
  });
  return { promise, resolve };
}

export function attachmentFixture() {
  let raw: string | null = null,
    current = true,
    uploads = 0,
    reads = 0,
    checks = 0,
    nextId = 80,
    now = Date.now();
  const sent: MessageDraft[] = [],
    confirmed: unknown[] = [];
  let status = {
    fileId: fixtureId(40),
    generation: 1,
    state: "READY",
  } as Awaited<ReturnType<ReturnType<typeof createMessagesApi>["fileStatus"]>>;
  const api: OutboxOptions["api"] = {
    send: async (_id, body) => {
      sent.push(body);
      return delivered;
    },
    delivery: async () => {
      checks++;
      return delivered;
    },
  };
  const files: Pick<
    ReturnType<typeof createMessagesApi>,
    "upload" | "fileStatus" | "retryAttachment"
  > = {
    upload: async (_id, body) => {
      assert.ok(body.has("file"));
      uploads++;
      return { fileId: fixtureId(40), state: "QUARANTINED" };
    },
    fileStatus: async () => {
      reads++;
      return status;
    },
    retryAttachment: async () => status,
  };
  const options: OutboxOptions = {
    ownerId: fixtureId(1),
    scope: "https://fixture.test",
    current: () => current,
    createId: () => fixtureId(nextId++),
    now: () => now,
    storage: {
      read: async () => raw,
      write: async (value) => {
        raw = value;
      },
    },
    api,
    delivered: (message) => {
      confirmed.push(message);
    },
  };
  const store = new AttachmentOutbox(options, files);
  return {
    store,
    api,
    files,
    options,
    sent,
    confirmed,
    counts: () => ({ uploads, reads, checks }),
    raw: () => raw,
    status: (next: Partial<typeof status>) => {
      status = { ...status, ...next };
    },
    expire: () => {
      current = false;
    },
    advance: (ms: number) => {
      now += ms;
    },
    row: () => store.getSnapshot().items[0]!,
  };
}
