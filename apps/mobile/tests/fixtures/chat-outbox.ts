import { TextOutbox } from "../../src/features/messages/outbox/text-outbox";
import type { OutboxApi } from "../../src/features/messages/outbox/outbox-delivery";
import type {
  ApiMessage,
  MessageDraft,
} from "../../src/features/messages/api/messages-api";
import { fixtureId } from "./learning-requests-data";

export const chatId = fixtureId(600),
  ownerId = fixtureId(1);
export function published(body: MessageDraft, number = 1): ApiMessage {
  return {
    id: fixtureId(700 + number),
    conversationId: chatId,
    senderId: ownerId,
    messageText: body.messageText ?? "",
    messageType: "TEXT",
    attachments: [],
    sequence: String(number),
    sentAt: "2026-10-19T10:00:00.000Z",
    readAt: null,
  };
}
export function memoryOutbox() {
  const box = { raw: null as string | null, fail: false };
  return {
    box,
    storage: {
      read: async () => box.raw,
      write: async (raw: string) => {
        if (box.fail) throw Error("disk");
        box.raw = raw;
      },
    },
  };
}
export function outboxHarness(api: OutboxApi, data = memoryOutbox()) {
  let now = Date.parse("2026-10-19T10:00:00.000Z"),
    current = true,
    next = 0;
  const confirmed: ApiMessage[] = [];
  const options = {
    ownerId,
    scope: "https://fixture.test/api/v1",
    storage: data.storage,
    api,
    createId: () => fixtureId(800 + ++next),
    now: () => now,
    current: () => current,
    delivered: (message: ApiMessage) => {
      confirmed.push(message);
    },
  };
  const store = new TextOutbox(options);
  return {
    store,
    data,
    confirmed,
    options,
    stale: () => {
      current = false;
    },
    advance: (ms = 30000) => {
      now += ms;
      store.wake();
    },
  };
}
export async function settle() {
  for (let i = 0; i < 12; i++)
    await new Promise<void>((resolve) => setImmediate(resolve));
}
export function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
