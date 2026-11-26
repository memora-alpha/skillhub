import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import type {
  ApiMessage,
  AttachmentAvailability,
} from "../src/features/messages/api/messages-api";
import { chatFailureCopy } from "../src/features/messages/utils/chat-failure-copy";
import { attachmentAvailabilityLabel } from "../src/features/messages/utils/attachment-availability";
import {
  attachmentCopy,
  isChatImage,
} from "../src/features/messages/utils/chat-attachment-kind";
import { AppError } from "../src/lib/http/errors";

test("image detection uses supported server MIME and failures distinguish images from documents", () => {
  assert.equal(isChatImage("image/jpeg"), true);
  assert.equal(isChatImage("image/svg+xml"), false);
  assert.equal(isChatImage("application/pdf"), false);
  assert.equal(
    attachmentCopy("Không đọc được tệp. Mở ứng dụng Tệp.", "image/png"),
    "Không đọc được ảnh. Mở ứng dụng Tệp.",
  );
  assert.equal(
    chatFailureCopy("CHAT_FILE_REJECTED", "image/png"),
    "Không gửi được ảnh do nội dung không phù hợp.",
  );
  assert.equal(
    chatFailureCopy("FILE_TOO_LARGE", "image/png"),
    "Ảnh vượt quá 15 MB.",
  );
  assert.equal(
    chatFailureCopy("CHAT_ATTACHMENT_TIMEOUT", "image/jpeg"),
    "Chưa xác nhận được ảnh đã gửi.",
  );
  assert.equal(
    chatFailureCopy("CHAT_FILE_REJECTED", "application/pdf"),
    "Không gửi được tệp do nội dung không phù hợp.",
  );
  assert.equal(
    attachmentAvailabilityLabel("REVOKED", "image/webp"),
    "Ảnh không còn khả dụng.",
  );
});

test("authenticated previews clean private files on revocation, disable and unmount and ignore old-owner bytes", async () => {
  const local = createRequire(
    new URL(
      "../src/features/messages/hooks/use-chat-image-preview.ts",
      import.meta.url,
    ),
  );
  const filename = local.resolve("./use-chat-image-preview.ts");
  let cursor = 0,
    current = true;
  const slots: unknown[] = [];
  const effects = new Map<number, { deps: unknown[]; cleanup?: () => void }>();
  const calls: unknown[][] = [];
  const disposed: string[] = [];
  let enabled = true;
  const tickets: ((value: Uint8Array) => void)[] = [];
  const failures: ((reason: unknown) => void)[] = [];
  let revoked = 0,
    reloads = 0;
  const runtime = {
    key: ["owner"],
    isCurrent: () => current,
    assertCurrent() {},
  };
  const cache = {};
  const api = {
    content: (...args: unknown[]) => {
      calls.push(args.slice(0, 4));
      return new Promise<Uint8Array>((resolve, reject) => {
        tickets.push(resolve);
        failures.push(reject);
      });
    },
  };
  const mocks = {
    react: {
      useState: (initial: unknown) => {
        const index = cursor++;
        if (!(index in slots)) slots[index] = initial;
        return [
          slots[index],
          (value: unknown) => {
            slots[index] =
              typeof value === "function" ? value(slots[index]) : value;
          },
        ];
      },
      useRef: (initial: unknown) => {
        const index = cursor++;
        return (slots[index] ??= { current: initial });
      },
      useEffect: (effect: () => (() => void) | undefined, deps: unknown[]) => {
        const index = cursor++;
        const previous = effects.get(index);
        if (
          previous &&
          deps.every((dep, i) => Object.is(dep, previous.deps[i]))
        )
          return;
        previous?.cleanup?.();
        effects.set(index, { deps, cleanup: effect() });
      },
    },
    "@tanstack/react-query": { useQueryClient: () => cache },
    "@/features/connections": { useConnections: () => runtime },
    "./use-messages-api": { useMessagesApi: () => api },
    "../utils/event-hydration": {
      reloadChatEventQueries: async () => {
        reloads++;
      },
    },
    "../utils/chat-media-file": {
      createChatMediaFile: (bytes: Uint8Array) => {
        const uri = new TextDecoder().decode(bytes);
        return { uri, dispose: () => disposed.push(uri) };
      },
    },
  };
  const contexts = Object.entries(mocks).map(([id, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(id)), { namedExports }),
  );
  const message = {
    id: "message",
    conversationId: "conversation",
  } as ApiMessage;
  const file = {
    attachmentId: "attachment",
    fileId: "file",
    availability: "PENDING_SCAN" as AttachmentAvailability,
    thumbnailUrlEndpoint: "/thumbnail",
    mimeType: "image/jpeg",
  } as ApiMessage["attachments"][number];
  const tick = () => new Promise((resolve) => setImmediate(resolve));
  const finish = (url: string) =>
    tickets.shift()!(new TextEncoder().encode(url));
  try {
    delete local.cache[filename];
    const { useChatImagePreview } = local(
      filename,
    ) as typeof import("../src/features/messages/hooks/use-chat-image-preview");
    const render = () => {
      cursor = 0;
      return useChatImagePreview(
        message,
        file,
        "thumbnail",
        enabled,
        () => revoked++,
      );
    };
    assert.equal(render().uri, undefined);
    assert.equal(calls.length, 0);
    file.availability = "AVAILABLE";
    render();
    assert.deepEqual(calls, [
      ["conversation", "message", "attachment", "thumbnail"],
    ]);
    finish("https://files.example/approved");
    await tick();
    assert.equal(render().uri, "https://files.example/approved");
    render().retry();
    render();
    assert.ok(disposed.includes("https://files.example/approved"));
    file.availability = "REVOKED";
    assert.equal(render().uri, undefined);
    finish("https://files.example/revoked");
    await tick();
    assert.equal(render().uri, undefined);
    assert.equal(calls.length, 2);
    file.availability = "UNAVAILABLE";
    render();
    assert.equal(calls.length, 2);
    file.availability = "AVAILABLE";
    render();
    finish("https://files.example/again");
    await tick();
    enabled = false;
    assert.equal(render().uri, undefined);
    assert.ok(disposed.includes("https://files.example/again"));
    enabled = true;
    render();
    finish("https://files.example/retry");
    await tick();
    assert.equal(render().uri, "https://files.example/retry");
    render().imageFailed();
    assert.equal(render().uri, undefined);
    assert.equal(render().error, "Không đọc được ảnh.");
    render().retry();
    render();
    current = false;
    finish("https://files.example/old-owner");
    await tick();
    assert.equal(render().uri, undefined);
    current = true;
    render().retry();
    render();
    for (const effect of effects.values()) effect.cleanup?.();
    const before = slots[1];
    finish("https://files.example/unmounted");
    await tick();
    assert.equal(slots[1], before);
    // Metadata can still say AVAILABLE when the content API has already revoked access.
    render().retry();
    render();
    failures.at(-1)!(new AppError("http", 409, "CONTENT_MODERATION_BLOCKED"));
    await tick();
    assert.equal(
      revoked,
      1,
      "the card must stop showing a load state before the history refresh completes",
    );
    assert.equal(render().error, "Ảnh không còn khả dụng.");
    assert.equal(render().loading, false);
    assert.equal(reloads, 1);
    render().retry();
    assert.equal(render().loading, true);
    failures.at(-1)!(new AppError("network"));
    await tick();
    assert.equal(render().loading, false);
    assert.equal(render().error, "Không tải được ảnh xem trước.");
    assert.equal(
      revoked,
      1,
      "ordinary network failures keep the retry action instead of marking the file revoked",
    );
    assert.equal(reloads, 1);
  } finally {
    for (const effect of effects.values()) effect.cleanup?.();
    delete local.cache[filename];
    contexts.reverse().forEach((context) => context.restore());
  }
});
