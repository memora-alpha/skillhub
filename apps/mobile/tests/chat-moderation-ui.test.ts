import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import type { QueuedText } from "../src/features/messages/outbox/outbox-types";
import { fixtureId } from "./fixtures/learning-requests-data";
import { colors } from "../src/constants/theme";

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
      useWindowDimensions: () => ({ width: 390 }),
    },
    "@/components/Icon": { Icon: "Icon" },
    "@/components/Avatar": { Avatar: "Avatar" },
    "./ChatImageCard": { ChatImageCard: "ImageCard" },
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
    assert.doesNotMatch(text(tree), /Không gửi được tin nhắn/);
    assert.match(
      elements(tree).find((node) => node.props.accessibilityRole === "alert")!
        .props.accessibilityLabel as string,
      /Không gửi được tin nhắn/,
    );
    assert.match(text(tree), /Nội dung tin nhắn không phù hợp\./);
    assert.doesNotMatch(text(tree), /soạn tin mới|có thể không phù hợp/);
    assert.doesNotMatch(text(tree), /Hãy sửa|sửa tin nhắn/);
    assert.doesNotMatch(text(tree), /Thử lại|Sửa tin|Bỏ tin/);
    assert.equal(
      elements(tree).filter((node) => node.props.accessibilityRole === "alert")
        .length,
      1,
    );
    const buttons = elements(tree).filter((node) => node.type === "Pressable");
    assert.equal(buttons.length, 0);
    assert.equal(retries, 0);
    const failureIcons = (tree: unknown) =>
      elements(tree).filter(
        (node) => node.type === "Icon" && node.props.name === "alert-circle",
      );
    assert.equal(failureIcons(tree).length, 1);
    assert.equal(failureIcons(tree)[0]!.props.color, colors.error);
    assert.match(
      text(render({ failureCode: "CONTACT_INFORMATION_NOT_ALLOWED" })),
      /Không được gửi thông tin cá nhân\./,
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
    for (const state of ["queued", "sending", "processing", "sent"] as const)
      assert.equal(failureIcons(render({ state })).length, 0);
    const failureTree = render({
      failureCode: "FORBIDDEN",
      failure: "Không có quyền gửi",
    });
    assert.match(text(failureTree), /Thử lại/);
    assert.equal(failureIcons(failureTree).length, 1);
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
    const attachment = {
      name: "lesson.pdf",
      uri: "file:///fixture",
      size: 100,
      mimeType: "application/pdf",
    };
    const photo = { ...attachment, name: "photo.jpg", mimeType: "image/jpeg" };
    const imageCard = (tree: unknown) =>
      elements(tree).find((node) => node.type === "ImageCard")!;
    assert.equal(
      imageCard(render({ state: "sending", attachment: photo })).props.uri,
      photo.uri,
    );
    assert.equal(
      imageCard(render({ state: "sending", attachment: photo })).props.status,
      undefined,
    );
    assert.equal(
      imageCard(
        render({
          state: "failed",
          attachment: photo,
          failureCode: "CHAT_FILE_REVOKED",
        }),
      ).props.status,
      "unavailable",
    );
    assert.equal(
      imageCard(
        render({
          state: "failed",
          attachment: photo,
          failureCode: "NETWORK_ERROR",
        }),
      ).props.status,
      undefined,
      "network failures retain the sender's local image",
    );
    const pendingFile = render({
      state: "sending",
      attachment,
      messageText: "",
    });
    assert.match(text(pendingFile), /lesson.pdf/);
    assert.match(text(pendingFile), /Đang gửi…/);
    assert.equal(failureIcons(pendingFile).length, 0);
    const failedFile = render({
      state: "failed",
      attachment,
      failure: "Hãy chọn tệp khác",
      failureCode: "CHAT_FILE_REJECTED",
    });
    assert.equal(failureIcons(failedFile).length, 1);
    assert.doesNotMatch(text(failedFile), /Thử lại/);
    assert.doesNotMatch(text(failedFile), /Hãy chọn tệp khác/);
    const alert = (tree: unknown) =>
      elements(tree).find((node) => node.props.accessibilityRole === "alert")!;
    for (const failed of [failureTree, failedFile]) {
      assert.equal(
        elements(failed).filter(
          (node) =>
            node.type === "Text" &&
            node.props.children === "Không gửi được tin nhắn",
        ).length,
        0,
      );
      assert.match(
        alert(failed).props.accessibilityLabel as string,
        /^Không gửi được tin nhắn\./,
      );
      assert.deepEqual(
        alert(failed).props.style,
        alert(tree).props.style,
        "text, file and network failures share one notice layout",
      );
    }
    assert.match(
      text(failedFile),
      /Không gửi được tệp do nội dung không phù hợp\./,
    );
    const blockedFile = render({ attachment });
    assert.match(
      text(blockedFile),
      /Không gửi được tệp do nội dung không phù hợp\./,
    );
    assert.doesNotMatch(
      text(blockedFile),
      /Thử lại|thu hồi|không được chấp nhận|sửa tin nhắn/,
    );
    assert.match(
      text(
        render({
          attachment,
          failureCode: "CHAT_ATTACHMENT_INTERRUPTED",
          failure: "old saved wording",
        }),
      ),
      /Không gửi được\..*Thử lại/,
    );
    const scanFailure = render({
      attachment,
      failureCode: "CHAT_FILE_SCAN_FAILED",
      failure: "old saved wording",
    });
    assert.match(text(scanFailure), /Không kiểm tra được tệp\./);
    assert.doesNotMatch(text(scanFailure), /Hãy chọn lại|gửi sau/);
    for (const failureCode of [
      "FILE_FORMAT_UNSUPPORTED",
      "CHAT_FILE_UNAVAILABLE",
      "FILE_EMPTY_OR_INVALID",
    ]) {
      const unreadable = render({
        attachment,
        failureCode,
        failure: "Không đọc được tệp. Chọn tệp khác.",
      });
      assert.match(text(unreadable), /Không đọc được tệp\./);
      assert.doesNotMatch(
        text(unreadable),
        /Chọn tệp khác|Chọn lại tệp|Vui lòng/,
      );
    }
    assert.equal(
      elements(scanFailure).filter((node) => node.type === "Pressable").length,
      0,
      "new wording must not offer an unsupported scan retry",
    );
    const interruptedFile = (offline: boolean) =>
      elements(
        render(
          { attachment, failureCode: "CHAT_ATTACHMENT_INTERRUPTED" },
          offline,
        ),
      ).find((node) => node.type === "Pressable")!;
    const offlineRetry = interruptedFile(true);
    assert.equal(offlineRetry.props.accessibilityLabel, "Thử gửi lại tệp");
    assert.equal(offlineRetry.props.disabled, true);
    assert.match(
      offlineRetry.props.accessibilityHint as string,
      /Kết nối mạng/,
    );
    const onlineRetry = interruptedFile(false);
    assert.equal(onlineRetry.props.disabled, false);
    (onlineRetry.props.onPress as () => void)();
    assert.equal(retries, 2);
  } finally {
    delete local.cache[filename];
    contexts.reverse().forEach((context) => context.restore());
  }
});
