import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";

test("attachment preview explains terminal storage failures instead of waiting for another scan", () => {
  const local = createRequire(
    new URL(
      "../src/features/messages/components/ChatAttachmentPreview.tsx",
      import.meta.url,
    ),
  );
  const filename = local.resolve("./ChatAttachmentPreview.tsx");
  const jsx = (type: unknown, props: unknown) => ({ type, props });
  const mocks = {
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "react-native": {
      View: "View",
      StyleSheet: { create: (value: unknown) => value },
    },
    "@/components/Button": { Button: "Button" },
    "@/components/FormNotice": { FormNotice: "Notice" },
    "@/features/connections": { ConnectionFeedback: "Feedback" },
    "./ChatAttachmentTile": { ChatAttachmentTile: "Tile" },
  };
  const contexts = Object.entries(mocks).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  try {
    delete local.cache[filename];
    const { ChatAttachmentPreview } = local(
      filename,
    ) as typeof import("../src/features/messages/components/ChatAttachmentPreview");
    const remove = () => {};
    const render = (state: string, processing = false) =>
      elements(
        ChatAttachmentPreview({
          attachment: {
            file: { name: "lesson.pdf", uri: "file:///lesson.pdf", size: 100 },
            status: { data: { state }, isFetching: false },
            uploaded: true,
            ready: false,
            locked: processing,
            processing,
            remove,
          } as unknown as Parameters<
            typeof ChatAttachmentPreview
          >[0]["attachment"],
          onRecovered() {},
        }),
      );
    for (const state of [
      "REJECTED",
      "SCAN_FAILED",
      "UPLOAD_FAILED",
      "CLEANUP_PENDING",
      "DELETED",
    ]) {
      const tree = render(state);
      const tile = tree.find((el) => el.type === "Tile")!;
      assert.notEqual(tile.props.status, "Chờ kiểm tra tệp…", state);
      assert.equal(
        tile.props.onRemove,
        remove,
        "the user can discard the failed file",
      );
      assert.ok(
        tree.some((el) => el.type === "Notice" && el.props.tone === "error"),
        state,
      );
      assert.equal(
        tree.some((el) => el.type === "Button"),
        false,
        "reading status cannot restart a failed scan",
      );
    }
    for (const state of ["QUARANTINED", "SCANNING"]) {
      const tree = render(state);
      assert.equal(
        tree.find((el) => el.type === "Tile")!.props.status,
        "Chờ kiểm tra tệp…",
      );
      assert.ok(tree.some((el) => el.type === "Button"));
      assert.equal(
        tree.some((el) => el.type === "Notice"),
        false,
      );
    }
    const delivery = render("DELETED", true);
    assert.equal(
      delivery.find((el) => el.type === "Tile")!.props.status,
      "Đang gửi…",
    );
    assert.equal(
      delivery.some((el) => el.type === "Notice" && el.props.tone === "error"),
      false,
      "an accepted message keeps delivery recovery instead of suggesting a new upload",
    );
    assert.ok(delivery.some((el) => el.type === "Button"));
  } finally {
    delete local.cache[filename];
    contexts.reverse().forEach((context) => context.restore());
  }
});

type Element = { type: unknown; props: Record<string, unknown> };
function elements(tree: unknown): Element[] {
  if (Array.isArray(tree)) return tree.flatMap(elements);
  if (!tree || typeof tree !== "object" || !("props" in tree)) return [];
  const el = tree as Element;
  if (typeof el.type === "function") return elements(el.type(el.props));
  return [el, ...elements(el.props.children)];
}

test("file messages stay in the message row and only open the authorized current download once", async () => {
  const local = createRequire(
    new URL(
      "../src/features/messages/components/ApiMessageBubble.tsx",
      import.meta.url,
    ),
  );
  let cursor = 0,
    current = true;
  const slots: unknown[] = [];
  const calls: string[][] = [],
    opened: string[] = [];
  let finish!: (result: { url: string; expiresAt: string }) => void;
  const jsx = (type: unknown, props: unknown) => ({ type, props });
  const mocks = {
    "react/jsx-runtime": { jsx, jsxs: jsx },
    react: {
      useState: (initial: unknown) => {
        const index = cursor++;
        if (!(index in slots)) slots[index] = initial;
        return [
          slots[index],
          (value: unknown) => {
            slots[index] = value;
          },
        ];
      },
      useRef: (initial: unknown) => {
        const index = cursor++;
        return (slots[index] ??= { current: initial });
      },
    },
    "react-native": {
      View: "View",
      Text: "Text",
      Pressable: "Pressable",
      StyleSheet: { create: (s: unknown) => s, hairlineWidth: 1 },
      useWindowDimensions: () => ({ width: 320 }),
    },
    "expo-router": { useRouter: () => ({ push() {} }) },
    "expo-linking": {
      openURL: async (url: string) => {
        opened.push(url);
      },
    },
    "@/components/Avatar": { Avatar: "Avatar" },
    "@/components/Icon": { Icon: "Icon" },
    "@/components/FormNotice": { FormNotice: "Notice" },
    "@/features/connections": {
      useConnections: () => ({ userId: "me", isCurrent: () => current }),
      connectionError: () => "Không mở được tệp",
      ConnectionFeedback: () => null,
    },
    "@/features/learning-paths/policy": {
      readPlanShare: () => null,
      readConfirmedForm: () => null,
      readNegotiationMessage: () => null,
      confirmedFormLabels: {},
    },
    "../hooks/use-messages-api": {
      useMessagesApi: () => ({
        download: (...args: string[]) => {
          calls.push(args);
          return new Promise<{ url: string; expiresAt: string }>((resolve) => {
            finish = resolve;
          });
        },
      }),
    },
    "./ChatWorkflowCard": { ChatWorkflowCard: "Workflow" },
  };
  const contexts = Object.entries(mocks).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  const filename = local.resolve("./ApiMessageBubble.tsx");
  try {
    delete local.cache[filename];
    const { ApiMessageBubble } = local(
      filename,
    ) as typeof import("../src/features/messages/components/ApiMessageBubble");
    const message = {
      id: "msg",
      conversationId: "chat",
      senderId: "me",
      messageText: "",
      messageType: "FILE" as const,
      attachments: [
        {
          attachmentId: "attachment",
          fileId: "file",
          filename: "tai-lieu-hoc-react-ban-cap-nhat.pdf",
          mimeType: "application/pdf",
          fileSizeBytes: 1_200_000,
          downloadUrlEndpoint: "/ignored",
        },
      ],
      sentAt: new Date().toISOString(),
      readAt: new Date().toISOString(),
      sequence: "1",
    };
    const render = (senderId = "me", caption = "") => {
      cursor = 0;
      return elements(
        ApiMessageBubble({
          message: { ...message, senderId, messageText: caption },
          partner: "Linh",
          partnerId: "them",
          showTime: true,
          showReadReceipt: true,
        }),
      );
    };
    const card = (tree: Element[]) =>
      tree.find((el) => el.type === "Pressable")!;
    const mine = render();
    assert.match(
      String(card(mine).props.accessibilityLabel),
      /Mở tệp .*1\.2 MB/,
    );
    assert.ok(
      !mine.some((el) => el.type === "Text" && el.props.children === ""),
      "file-only messages have no empty text bubble",
    );
    assert.ok(
      render("them").some((el) => el.type === "Avatar" && el.props.size === 24),
    );
    assert.ok(
      render("me", "Tài liệu buổi học").some(
        (el) =>
          el.type === "Text" &&
          Array.isArray(el.props.children) &&
          el.props.children.includes("Tài liệu buổi học"),
      ),
    );
    const press = card(render()).props.onPress as () => void;
    press();
    press();
    assert.deepEqual(calls, [["chat", "msg", "attachment"]]);
    assert.deepEqual(card(render()).props.accessibilityState, {
      busy: true,
      disabled: true,
    });
    finish({
      url: "https://files.example/document",
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(opened, ["https://files.example/document"]);
    (card(render()).props.onPress as () => void)();
    finish({
      url: "https://files.example/expired",
      expiresAt: new Date(Date.now() - 1).toISOString(),
    });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(opened.length, 1);
    assert.ok(
      render().some(
        (el) =>
          el.type === "Notice" && String(el.props.children).includes("hết hạn"),
      ),
      "expired links explain why the tap did not open a file",
    );
    (card(render()).props.onPress as () => void)();
    current = false;
    finish({
      url: "https://files.example/stale-account",
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(
      opened.length,
      1,
      "changing accounts prevents opening a stale download",
    );
    const { fileSizeLabel } = local(
      "./ChatFileCard.tsx",
    ) as typeof import("../src/features/messages/components/ChatFileCard");
    assert.equal(fileSizeLabel(0), "0 B");
    assert.equal(fileSizeLabel(12_001), "13 KB");
    const { ChatAttachmentTile } = local(
      "./ChatAttachmentTile.tsx",
    ) as typeof import("../src/features/messages/components/ChatAttachmentTile");
    let removed = 0;
    const file = { name: "tai-lieu.pdf", uri: "file:///local.pdf", size: 1200 };
    const tile = (locked: boolean) =>
      card(
        elements(
          ChatAttachmentTile({
            file,
            locked,
            onRemove: () => {
              removed++;
            },
          }),
        ),
      );
    assert.equal(tile(true).props.disabled, true);
    (tile(true).props.onPress as () => void)();
    assert.equal(
      removed,
      0,
      "upload or delivery locks cannot discard the selected intent",
    );
    assert.equal(tile(false).props.accessibilityLabel, "Bỏ tệp tai-lieu.pdf");
    (tile(false).props.onPress as () => void)();
    assert.equal(removed, 1);
    const { ChatAttachmentPreview } = local(
      "./ChatAttachmentPreview.tsx",
    ) as typeof import("../src/features/messages/components/ChatAttachmentPreview");
    const draft = {
      file,
      status: { isFetching: false },
      locked: false,
      ready: true,
      remove() {},
      retry: async () => "caption gốc",
    } as unknown as Parameters<typeof ChatAttachmentPreview>[0]["attachment"];
    const readyPreview = elements(
      ChatAttachmentPreview({ attachment: draft, onRecovered() {} }),
    );
    assert.equal(
      readyPreview.filter((el) => el.type === "Pressable").length,
      1,
      "ready preview only has the remove action, sending belongs to the composer",
    );
    const recovered: string[] = [];
    const uncertain = elements(
      ChatAttachmentPreview({
        attachment: { ...draft, ready: false, uncertain: true, locked: true },
        onRecovered: (text) => {
          recovered.push(text);
        },
      }),
    );
    const retry = uncertain.filter((el) => el.type === "Pressable").at(-1)!;
    (retry.props.onPress as () => void)();
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(
      recovered,
      ["caption gốc"],
      "delivery recovery keeps the existing intent and caption",
    );
  } finally {
    delete local.cache[filename];
    contexts.reverse().forEach((ctx) => ctx.restore());
  }
});
