import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import type { ApiMessage } from "../src/features/messages/api/messages-api";

type Element = { type: unknown; props: Record<string, unknown> };

test("image publication stays an image across pending, available and revoked states and never mounts a restricted preview", () => {
  const local = createRequire(
    new URL(
      "../src/features/messages/components/ChatImageMessage.tsx",
      import.meta.url,
    ),
  );
  const filename = local.resolve("./ChatImageMessage.tsx");
  let previews = 0;
  let unavailableFor: unknown;
  let localUri: string | undefined;
  let remoteUri: string | undefined = "file:///authorized";
  const effects: (() => void)[] = [];
  const jsx = (type: unknown, props: unknown) => ({ type, props });
  const contexts = Object.entries({
    "react/jsx-runtime": { jsx, jsxs: jsx },
    react: {
      useEffect: (effect: () => void) => effects.push(effect),
      useState: (value: unknown) =>
        typeof value === "boolean"
          ? [value, () => {}]
          : [
              unavailableFor,
              (next: unknown) => {
                unavailableFor = next;
              },
            ],
    },
    "./ChatImageCard": { ChatImageCard: "ImageCard" },
    "../hooks/use-sent-chat-image": {
      useSentChatImage: () => ({
        uri: localUri,
        release() {
          localUri = undefined;
        },
      }),
    },
    "../hooks/use-chat-image-preview": {
      useChatImagePreview: () => {
        previews++;
        return {
          uri: remoteUri,
          loading: !remoteUri,
          retry() {},
          imageFailed() {},
        };
      },
    },
  }).map(([id, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(id)), { namedExports }),
  );
  try {
    delete local.cache[filename];
    const { ChatImageMessage } = local(
      filename,
    ) as typeof import("../src/features/messages/components/ChatImageMessage");
    const file: ApiMessage["attachments"][number] = {
      attachmentId: "a",
      fileId: "f",
      filename: "photo.jpg",
      mimeType: "image/jpeg",
      fileSizeBytes: 10,
      downloadUrlEndpoint: "/unused",
    };
    const message = {
      id: "m",
      conversationId: "c",
      attachments: [file],
    } as ApiMessage;
    for (const mine of [true, false]) {
      for (const availability of [
        "PENDING_SCAN",
        "REVOKED",
        "UNAVAILABLE",
      ] as const) {
        const node = ChatImageMessage({
          message,
          file: { ...file, availability },
          mine,
          pending: false,
          onDownload() {
            throw new Error("restricted download");
          },
        }) as Element;
        assert.equal(node.type, "ImageCard");
        assert.equal(
          node.props.status,
          availability === "PENDING_SCAN" ? "pending" : "unavailable",
        );
        assert.equal(node.props.uri, undefined);
        assert.equal(node.props.onDownload, undefined);
      }
    }
    assert.equal(
      previews,
      0,
      "a restricted image must not mount either authenticated fetch",
    );
    const review = ChatImageMessage({
      message,
      file: {
        ...file,
        availability: "PENDING_SCAN",
        moderationStatus: "REVIEW_REQUIRED",
      },
      mine: true,
      pending: false,
      onDownload() {},
    }) as Element;
    assert.equal(
      review.props.status,
      "review",
      "manual review is not an upload that can finish by waiting",
    );
    assert.equal(review.props.uri, undefined);
    const available = ChatImageMessage({
      message,
      file: { ...file, availability: "AVAILABLE" },
      mine: true,
      pending: false,
      onDownload() {},
    }) as Element;
    assert.equal(typeof available.type, "function");
    const rendered = (available.type as (props: unknown) => Element)(
      available.props,
    );
    assert.equal(rendered.type, "ImageCard");
    assert.equal(rendered.props.uri, "file:///authorized");
    assert.equal(previews, 2);
    localUri = "file:///selected.jpg";
    const waiting = ChatImageMessage({
      message,
      file: { ...file, availability: "PENDING_SCAN" },
      mine: true,
      pending: false,
      onDownload() {},
    }) as Element;
    assert.equal(
      waiting.props.uri,
      localUri,
      "sender keeps the local pixels after publication while BE is processing",
    );
    assert.equal(waiting.props.status, undefined);
    const recipient = ChatImageMessage({
      message,
      file: { ...file, availability: "PENDING_SCAN" },
      mine: false,
      pending: false,
      onDownload() {},
    }) as Element;
    assert.equal(recipient.props.uri, undefined);
    assert.equal(recipient.props.status, "pending");
    const revoked = ChatImageMessage({
      message,
      file: { ...file, availability: "REVOKED" },
      mine: true,
      pending: false,
      onDownload() {},
    }) as Element;
    assert.equal(revoked.props.uri, undefined);
    assert.equal(revoked.props.status, "unavailable");
    remoteUri = undefined;
    const awaitingThumbnail = ChatImageMessage({
      message,
      file: { ...file, availability: "AVAILABLE" },
      mine: true,
      pending: false,
      onDownload() {},
    }) as Element;
    const renderAvailable = awaitingThumbnail.type as (
      props: unknown,
    ) => Element;
    effects.length = 0;
    const beforeThumbnail = renderAvailable(awaitingThumbnail.props);
    assert.equal(beforeThumbnail.props.uri, "file:///selected.jpg");
    effects.pop()!();
    assert.equal(
      localUri,
      "file:///selected.jpg",
      "no thumbnail yet: do not dispose the fallback pixels",
    );
    remoteUri = "file:///authorized";
    const afterThumbnail = renderAvailable(awaitingThumbnail.props);
    assert.equal(afterThumbnail.props.uri, remoteUri);
    effects.pop()!();
    assert.equal(
      localUri,
      undefined,
      "authenticated thumbnail is ready before disposing the local file",
    );
    const callsBeforeDenial = previews;
    (available.props.onUnavailable as () => void)();
    const denied = ChatImageMessage({
      message,
      file: { ...file, availability: "AVAILABLE" },
      mine: true,
      pending: false,
      onDownload() {},
    }) as Element;
    assert.equal(
      denied.type,
      "ImageCard",
      "the fetching branch unmounts immediately when content access is denied",
    );
    assert.equal(denied.props.status, "unavailable");
    assert.equal(denied.props.uri, undefined);
    assert.equal(denied.props.onDownload, undefined);
    assert.equal(
      previews,
      callsBeforeDenial,
      "unchanged stale metadata cannot remount a denied preview",
    );
    const restored = ChatImageMessage({
      message,
      file: {
        ...file,
        availability: "AVAILABLE",
        moderationStatus: "APPROVED",
      },
      mine: true,
      pending: false,
      onDownload() {},
    }) as Element;
    assert.equal(
      typeof restored.type,
      "function",
      "a changed server state can allow a new preview",
    );
  } finally {
    delete local.cache[filename];
    contexts.reverse().forEach((context) => context.restore());
  }
});
