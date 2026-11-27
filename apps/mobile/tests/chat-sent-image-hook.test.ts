import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import { SentChatImages } from "../src/features/messages/outbox/sent-chat-images";
import { delivered, file } from "./fixtures/attachment-outbox";
import type { QueuedText } from "../src/features/messages/outbox/outbox-types";

test("only the current sender can reuse the local image before the receipt, after reconciliation and until revocation", () => {
  const local = createRequire(
    new URL(
      "../src/features/messages/hooks/use-sent-chat-image.ts",
      import.meta.url,
    ),
  );
  const filename = local.resolve("./use-sent-chat-image.ts");
  const store = new SentChatImages();
  let current = true,
    disposed = 0;
  assert.equal(delivered.deliveryStatus, "DELIVERED");
  const message = {
    ...delivered.message,
    attachments: delivered.message.attachments.map((item) => ({
      ...item,
      mimeType: "image/jpeg",
      availability: "PENDING_SCAN" as const,
    })),
  };
  const photo = {
    ...file,
    mimeType: "image/jpeg",
    fileId: message.attachments[0]!.fileId,
  };
  const runtime = { userId: message.senderId, isCurrent: () => current };
  let entries = [
    {
      conversationId: message.conversationId,
      state: "sending",
      attachment: photo,
    },
  ] as QueuedText[];
  const contexts = Object.entries({
    react: {
      useCallback: (callback: () => void) => callback,
      useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) =>
        snapshot(),
      useEffect: (effect: () => void) => effect(),
    },
    "@/features/connections": { useConnections: () => runtime },
    "../context/ChatOutbox": {
      useSentChatImages: () => store,
      useChatOutboxEntries: () => entries,
    },
  }).map(([id, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(id)), { namedExports }),
  );
  try {
    delete local.cache[filename];
    const { useSentChatImage } = local(
      filename,
    ) as typeof import("../src/features/messages/hooks/use-sent-chat-image");
    const render = () => useSentChatImage(message, message.attachments[0]!);
    assert.equal(
      render().uri,
      photo.uri,
      "SSE before the POST receipt must not discard the sender's preview",
    );
    store.retain(message, photo, () => disposed++);
    entries = [];
    assert.equal(
      render().uri,
      photo.uri,
      "removing the delivered outbox row must not dispose its preview",
    );
    runtime.userId = "another-owner";
    assert.equal(render().uri, undefined);
    assert.equal(disposed, 1);
    runtime.userId = message.senderId;
    store.retain(message, photo, () => disposed++);
    const revoked = {
      ...message.attachments[0]!,
      availability: "REVOKED" as const,
    };
    assert.equal(useSentChatImage(message, revoked).uri, undefined);
    assert.equal(disposed, 2);
    current = false;
    entries = [
      {
        conversationId: message.conversationId,
        state: "sending",
        attachment: photo,
      },
    ] as QueuedText[];
    assert.equal(render().uri, undefined);
  } finally {
    store.clear();
    delete local.cache[filename];
    contexts.reverse().forEach((context) => context.restore());
  }
});
