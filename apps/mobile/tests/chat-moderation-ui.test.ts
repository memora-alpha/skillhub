import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import type { QueuedText } from "../src/features/messages/outbox/outbox-types";
import { fixtureId } from "./fixtures/learning-requests-data";

type Element = { type: unknown; props: Record<string, unknown> };
function expand(tree: unknown): unknown {
  if (Array.isArray(tree)) return tree.map(expand);
  if (!tree || typeof tree !== "object" || !("props" in tree)) return tree;
  const node = tree as Element;
  if (typeof node.type === "function") return expand(node.type(node.props));
  return {
    ...node,
    props: { ...node.props, children: expand(node.props.children) },
  };
}
function elements(tree: unknown): Element[] {
  if (Array.isArray(tree)) return tree.flatMap(elements);
  if (!tree || typeof tree !== "object" || !("props" in tree)) return [];
  const node = tree as Element;
  return [node, ...elements(node.props.children)];
}
function text(tree: unknown): string {
  if (typeof tree === "string") return tree;
  if (Array.isArray(tree)) return tree.map(text).join(" ");
  return tree && typeof tree === "object" && "props" in tree
    ? text((tree as Element).props.children)
    : "";
}

test("chat only warns for blocked messages and shows sending without mentioning moderation", () => {
  const local = createRequire(
    new URL(
      "../src/features/messages/components/QueuedMessageBubble.tsx",
      import.meta.url,
    ),
  );
  const filename = local.resolve("./QueuedMessageBubble.tsx");
  const jsx = (type: unknown, props: unknown) => ({ type, props });
  const mocks = {
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "react-native": {
      View: "View",
      Text: "Text",
      Pressable: "Pressable",
      StyleSheet: { create: (value: unknown) => value },
    },
    "@/components/Icon": { Icon: "Icon" },
    "./MessageBubble": { MessageBubble: "Bubble" },
  };
  const contexts = Object.entries(mocks).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  let retries = 0;
  const entry: QueuedText = {
    clientMessageId: fixtureId(80),
    conversationId: fixtureId(40),
    messageText: "blocked",
    state: "failed",
    phase: "check",
    attempts: 1,
    retryAt: 0,
    createdAt: "2026-11-21T00:00:00Z",
    failureCode: "CONTENT_MODERATION_BLOCKED",
  };
  try {
    delete local.cache[filename];
    const { QueuedMessageBubble } = local(
      filename,
    ) as typeof import("../src/features/messages/components/QueuedMessageBubble");
    const render = (overrides: Partial<QueuedText> = {}, offline = false) =>
      expand(
        QueuedMessageBubble({
          entry: { ...entry, ...overrides },
          offline,
          onRetry: () => retries++,
        }),
      );
    const tree = render();
    assert.match(text(tree), /Không gửi được tin nhắn/);
    assert.match(text(tree), /ngôn từ nhạy cảm hoặc nội dung không phù hợp/);
    assert.doesNotMatch(text(tree), /Thử lại|Sửa tin|Bỏ tin/);
    assert.equal(
      elements(tree).filter((node) => node.props.accessibilityRole === "alert")
        .length,
      1,
    );
    const buttons = elements(tree).filter((node) => node.type === "Pressable");
    assert.equal(buttons.length, 0);
    assert.equal(retries, 0);
    assert.match(
      text(render({ failureCode: "CONTACT_INFORMATION_NOT_ALLOWED" })),
      /số điện thoại, email/,
    );
    assert.match(
      text(
        render({
          state: "queued",
          failureCode: "CONTENT_MODERATION_TEMPORARILY_UNAVAILABLE",
        }),
      ),
      /Đang gửi…/,
    );
    assert.doesNotMatch(
      text(
        render({
          state: "queued",
          failureCode: "CONTENT_MODERATION_TEMPORARILY_UNAVAILABLE",
        }),
      ),
      /kiểm tra nội dung|kiểm duyệt/i,
    );
    assert.equal(
      elements(
        render({
          state: "queued",
          failureCode: "CONTENT_MODERATION_TEMPORARILY_UNAVAILABLE",
        }),
      ).filter((node) => node.type === "Pressable").length,
      0,
    );
    assert.match(text(render({ state: "queued" }, true)), /Chờ kết nối/);
    const failureTree = render({
      failureCode: "FORBIDDEN",
      failure: "Không có quyền gửi",
    });
    assert.match(text(failureTree), /Thử lại/);
    (
      elements(failureTree).find((node) => node.type === "Pressable")!.props
        .onPress as () => void
    )();
    assert.equal(retries, 1);
    assert.equal(
      elements(render({ state: "sent" })).filter(
        (node) => node.props.accessibilityLiveRegion,
      ).length,
      0,
    );
  } finally {
    delete local.cache[filename];
    contexts.reverse().forEach((context) => context.restore());
  }
});
