import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import type { ApiMessage } from "../src/features/messages/api/messages-api";

test("leaving a file message prevents its in-flight download from opening after unmount", async () => {
  const local = createRequire(
    new URL(
      "../src/features/messages/hooks/use-chat-attachment-download.ts",
      import.meta.url,
    ),
  );
  const filename = local.resolve("./use-chat-attachment-download.ts");
  let cleanup!: () => void;
  let finish!: (result: Uint8Array) => void;
  const opened: Uint8Array[] = [];
  const pending = new Promise<Uint8Array>((resolve) => {
    finish = resolve;
  });
  const mocks = {
    react: {
      useRef: (value: unknown) => ({ current: value }),
      useState: (value: unknown) => [value, () => {}],
      useLayoutEffect: (effect: () => () => void) => {
        cleanup = effect();
      },
    },
    "@tanstack/react-query": { useQueryClient: () => ({}) },
    "@/features/connections": {
      useConnections: () => ({ isCurrent: () => true }),
    },
    "./use-messages-api": {
      useMessagesApi: () => ({ content: () => pending }),
    },
    "../utils/chat-media-file": {
      prepareChatDownload: async () => async (bytes: Uint8Array) => {
        opened.push(bytes);
      },
    },
  };
  const contexts = Object.entries(mocks).map(([id, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(id)), { namedExports }),
  );
  try {
    delete local.cache[filename];
    const { useChatAttachmentDownload } = local(
      filename,
    ) as typeof import("../src/features/messages/hooks/use-chat-attachment-download");
    const message: ApiMessage = {
      id: "message",
      conversationId: "chat",
      senderId: "sender",
      messageText: "",
      messageType: "FILE",
      sequence: "1",
      sentAt: "2026-11-25T00:00:00Z",
      readAt: null,
      attachments: [
        {
          attachmentId: "attachment",
          fileId: "file",
          filename: "lesson.pdf",
          mimeType: "application/pdf",
          fileSizeBytes: 100,
          downloadUrlEndpoint: "/fixture",
          availability: "AVAILABLE",
        },
      ],
    };
    const download = useChatAttachmentDownload(message).download("attachment");
    await new Promise((resolve) => setImmediate(resolve));
    cleanup();
    finish(new Uint8Array([1, 2, 3]));
    await download;
    assert.deepEqual(opened, []);
  } finally {
    delete local.cache[filename];
    contexts.reverse().forEach((context) => context.restore());
  }
});
