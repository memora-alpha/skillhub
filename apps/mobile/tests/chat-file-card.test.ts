import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import type { AttachmentAvailability } from "../src/features/messages/api/message-contracts";
import { AppError } from "../src/lib/http/errors";
import type { ApiMessage } from "../src/features/messages/api/messages-api";

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
  const cleanups: (() => void)[] = [];
  const calls: string[][] = [],
    opened: string[] = [];
  let finish!: (result: Uint8Array) => void;
  let rejectDownload!: (error: unknown) => void;
  const invalidated: unknown[] = [];
  const jsx = (type: unknown, props: unknown) => ({ type, props });
  const mocks = {
    "@tanstack/react-query": {
      useQueryClient: () => ({
        cancelQueries: async () => {},
        setQueryData() {},
        invalidateQueries: async (filter: { queryKey: unknown[] }) => {
          invalidated.push(filter.queryKey);
        },
      }),
    },
    "react/jsx-runtime": { jsx, jsxs: jsx },
    react: {
      useLayoutEffect: (effect: () => () => void) => {
        const index = cursor++;
        if (!(index in slots)) {
          slots[index] = true;
          cleanups.push(effect());
        }
      },
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
    "../utils/chat-media-file": {
      prepareChatDownload: async () => async (bytes: Uint8Array) => {
        opened.push(new TextDecoder().decode(bytes));
      },
    },
    "@/components/Avatar": { Avatar: "Avatar" },
    "@/components/Icon": { Icon: "Icon" },
    "expo-image": { Image: "Image" },
    "@/components/FormNotice": { FormNotice: "Notice" },
    "@/features/connections": {
      useConnections: () => ({
        userId: "me",
        key: ["owner"],
        assertCurrent: () => {
          if (!current) throw new Error("session");
        },
        isCurrent: () => current,
      }),
      connectionError: () => "Không mở được tệp",
      ConnectionFeedback: () => null,
    },
    "@/features/learning-paths/policy": {
      readPlanShare: () => null,
      readConfirmedForm: () => null,
      readScheduledMessage: () => null,
      readScheduleConfirmation: () => null,
      readNegotiationMessage: () => null,
      confirmedFormLabels: {},
    },
    "../hooks/use-messages-api": {
      useMessagesApi: () => ({
        content: (...args: unknown[]) => {
          calls.push(args.slice(0, 3) as string[]);
          return new Promise<Uint8Array>((resolve, reject) => {
            finish = resolve;
            rejectDownload = reject;
          });
        },
      }),
    },
    "./ChatWorkflowCard": { ChatWorkflowCard: "Workflow" },
    "./ChatImageMessage": { ChatImageMessage: "ImageMessage" },
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
          availability: undefined as AttachmentAvailability | undefined,
          moderationStatus:
            undefined as ApiMessage["attachments"][number]["moderationStatus"],
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
    message.attachments[0]!.mimeType = "image/jpeg";
    assert.ok(
      render().some((node) => node.type === "ImageMessage"),
      "published photos use the image presentation",
    );
    message.attachments[0]!.mimeType = "application/pdf";
    message.attachments[0]!.availability = "PENDING_SCAN";
    message.attachments[0]!.moderationStatus = "REVIEW_REQUIRED";
    const review = render();
    assert.ok(
      review.some(
        (node) =>
          node.type === "Text" &&
          node.props.children === "Tệp cần kiểm tra thêm.",
      ),
    );
    assert.ok(!review.some((node) => node.props.children === "Đang tải lên…"));
    assert.ok(
      !review.some((node) => node.type === "Pressable"),
      "manual review cannot expose a download action",
    );
    message.attachments[0]!.availability = undefined;
    message.attachments[0]!.moderationStatus = undefined;
    assert.match(
      String(card(mine).props.accessibilityLabel),
      /Tải tệp .*1\.2 MB/,
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
          [el.props.children].flat().includes("Tài liệu buổi học"),
      ),
    );
    const press = card(render()).props.onPress as () => void;
    press();
    press();
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(calls, [["chat", "msg", "attachment"]]);
    assert.deepEqual(card(render()).props.accessibilityState, {
      busy: true,
      disabled: true,
    });
    finish(new TextEncoder().encode("https://files.example/document"));
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(opened, ["https://files.example/document"]);
    for (const [availability, label] of [
      ["PENDING_SCAN", "Đang tải lên…"],
      ["REVOKED", "Tệp không còn khả dụng."],
      ["UNAVAILABLE", "Không thể mở tệp này"],
    ] as const) {
      message.attachments[0]!.availability = availability;
      for (const sender of ["me", "them"]) {
        const revokedNotice = "Tệp chứa nội dung không phù hợp.";
        const tree = render(sender);
        if (availability === "REVOKED" && sender === "them") {
          assert.ok(
            tree.some(
              (node) => node.type === "Text" && node.props.children === label,
            ),
          );
          assert.equal(
            tree.some(
              (node) =>
                node.type === "Text" &&
                node.props.children === message.attachments[0]!.filename,
            ),
            false,
          );
          assert.equal(
            tree.some((node) => node.type === "Pressable"),
            false,
          );
          assert.equal(
            tree.some((node) => node.type === "Icon"),
            false,
          );
          assert.equal(
            tree.some((node) => node.props.accessibilityRole === "alert"),
            false,
          );
          const notice = tree.find(
            (node) => node.type === "Text" && node.props.children === label,
          )!;
          assert.equal(
            (notice.props.style as { fontStyle: string }).fontStyle,
            "italic",
          );
          const caption = render(sender, "Nội dung vẫn giữ");
          assert.ok(
            caption.some(
              (node) =>
                node.type === "Text" &&
                node.props.children === "Nội dung vẫn giữ",
            ),
          );
          assert.equal(
            caption.some(
              (node) =>
                node.type === "Icon" && node.props.name === "alert-circle",
            ),
            false,
          );
          assert.equal(
            caption.some((node) => node.props.accessibilityRole === "alert"),
            false,
          );
          assert.equal(
            caption.some((node) =>
              String(node.props.accessibilityLabel).includes(
                "Tệp không còn khả dụng.",
              ),
            ),
            false,
          );
          continue;
        }
        assert.equal(
          tree.filter(
            (node) =>
              node.type === "Icon" && node.props.name === "alert-circle",
          ).length,
          availability === "REVOKED" || availability === "UNAVAILABLE" ? 1 : 0,
          "only visible problem files show an error icon",
        );
        assert.equal(
          tree.some((node) => node.type === "Pressable"),
          false,
          "blocked availability hides the download action for both sides",
        );
        assert.ok(
          tree.some(
            (node) => node.type === "Text" && node.props.children === label,
          ),
        );
        if (availability === "PENDING_SCAN") {
          const fileCard = tree.find((node) => node.props.accessible === true)!;
          assert.ok(fileCard);
          const cardContents = elements(fileCard.props.children);
          assert.equal(
            cardContents.some(
              (node) => node.type === "Text" && node.props.children === label,
            ),
            false,
            "scan status is below the message instead of inside the file card",
          );
          assert.ok(
            cardContents.some(
              (node) =>
                node.type === "Text" && node.props.children === "PDF · 1.2 MB",
            ),
            "pending cards keep their file type and size",
          );
        }
        assert.equal(
          tree.some(
            (node) =>
              node.type === "Text" && node.props.children === revokedNotice,
          ),
          availability === "REVOKED",
          "only sender revoked files show the default content note",
        );
        if (availability === "REVOKED") {
          assert.ok(
            tree.some(
              (node) =>
                node.props.accessibilityRole === "alert" &&
                node.props.accessibilityLabel === revokedNotice,
            ),
          );
          const fileCard = tree.find(
            (node) =>
              node.props.accessible === true &&
              String(node.props.accessibilityLabel).includes(
                "Tệp không còn khả dụng.",
              ),
          )!;
          assert.ok(fileCard);
          assert.equal(
            elements(fileCard.props.children).some(
              (node) =>
                node.type === "Text" && node.props.children === revokedNotice,
            ),
            false,
            "revocation note stays below the message, outside the file card",
          );
        }
      }
    }
    message.attachments[0]!.availability = "AVAILABLE";
    assert.equal(
      render().filter(
        (node) => node.type === "Icon" && node.props.name === "alert-circle",
      ).length,
      0,
      "normal file messages do not reserve an error indicator",
    );
    (card(render()).props.onPress as () => void)();
    await new Promise((resolve) => setImmediate(resolve));
    message.attachments[0]!.availability = "REVOKED";
    render();
    const before = calls.length;
    press();
    assert.equal(
      calls.length,
      before,
      "a stale press callback cannot download a revoked file",
    );
    finish(new TextEncoder().encode("https://files.example/stale-ticket"));
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(
      opened.length,
      1,
      "a download ticket returned after revocation must never open",
    );
    message.attachments[0]!.availability = "AVAILABLE";
    (card(render()).props.onPress as () => void)();
    await new Promise((resolve) => setImmediate(resolve));
    rejectDownload(new AppError("http", 409, "CONTENT_MODERATION_BLOCKED"));
    await new Promise((resolve) => setImmediate(resolve));
    assert.ok(
      render().some(
        (node) =>
          node.type === "Notice" &&
          String(node.props.children).includes(
            "Tệp chứa nội dung không phù hợp.",
          ),
      ),
    );
    assert.deepEqual(invalidated, [["owner", "thread", "chat"]]);
    message.attachments[0]!.mimeType = "image/jpeg";
    const imageFailure = render().find((node) => node.type === "ImageMessage")!;
    assert.match(
      String(imageFailure.props.downloadError),
      /Ảnh chứa nội dung không phù hợp/,
    );
    message.attachments[0]!.mimeType = "application/pdf";
    (card(render()).props.onPress as () => void)();
    await new Promise((resolve) => setImmediate(resolve));
    rejectDownload(new AppError("http", 401, "INVALID_TOKEN"));
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(opened.length, 1);
    assert.ok(
      render().some(
        (el) =>
          el.type === "Notice" &&
          String(el.props.children).includes("Không mở được tệp"),
      ),
      "failed authenticated reads explain why the file was not saved",
    );
    (card(render("them", "Caption remains")).props.onPress as () => void)();
    await new Promise((resolve) => setImmediate(resolve));
    rejectDownload(new AppError("http", 409, "CONTENT_MODERATION_BLOCKED"));
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(
      render("them", "Caption remains").some((node) => node.type === "Notice"),
      false,
      "the recipient never sees a download-revocation error banner",
    );
    message.attachments[0]!.availability = "REVOKED";
    assert.equal(
      render("them", "Caption remains").some((node) => node.type === "Notice"),
      false,
      "feedback from a hidden file does not remain under the caption",
    );
    message.attachments[0]!.availability = "AVAILABLE";
    (card(render()).props.onPress as () => void)();
    await new Promise((resolve) => setImmediate(resolve));
    current = false;
    finish(new TextEncoder().encode("https://files.example/stale-account"));
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
    assert.ok(
      elements(
        ChatAttachmentTile({
          file: { ...file, name: "photo.jpg", previewUri: "file:///photo.jpg" },
          locked: false,
          onRemove() {},
        }),
      ).some(
        (node) =>
          node.type === "Image" &&
          (node.props.source as { uri: string }).uri === "file:///photo.jpg",
      ),
    );
    const { ChatAttachmentPreview } = local(
      "./ChatAttachmentPreview.tsx",
    ) as typeof import("../src/features/messages/components/ChatAttachmentPreview");
    const draft = {
      file,
      locked: false,
      ready: true,
      pending: false,
      preparing: false,
      error: undefined,
      errorSource: undefined,
      remove() {},
      choose: async () => {},
      paste: async () => {},
      send: () => false,
    } satisfies Parameters<typeof ChatAttachmentPreview>[0]["attachment"];
    const readyPreview = elements(ChatAttachmentPreview({ attachment: draft }));
    assert.equal(
      readyPreview.filter((el) => el.type === "Pressable").length,
      1,
      "ready preview only has the remove action, sending belongs to the composer",
    );
  } finally {
    cleanups.reverse().forEach((cleanup) => cleanup());
    delete local.cache[filename];
    contexts.reverse().forEach((ctx) => ctx.restore());
  }
});
