import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import { fixtureId } from "./fixtures/learning-requests-data";
import { AppError } from "../src/lib/http/errors";
import { filePickerError } from "../src/lib/http/file-picker-error";
import { validateChatFile } from "../src/features/messages/utils/chat-file";

function harness() {
  const local = createRequire(
    new URL(
      "../src/features/messages/hooks/use-chat-attachment.ts",
      import.meta.url,
    ),
  );
  const filename = local.resolve("./use-chat-attachment.ts");
  const slots: unknown[] = [];
  let cursor = 0;
  let effects: (() => void)[] = [];
  let current = true;
  const file = {
    name: "lesson.pdf",
    uri: "file:///lesson.pdf",
    mimeType: "application/pdf",
    size: 100,
  };
  const calls = {
    choose: 0,
    uploads: 0,
    sends: [] as unknown[],
    retries: 0,
    reads: 0,
  };
  let pick = async () => ({ canceled: false, assets: [file] });
  let upload = async () => ({ fileId: fixtureId(40) });
  let latest = async () => ({
    data: { state: "READY" },
    error: undefined as unknown,
  });
  let sendResult = true;
  const sender = {
    pending: false,
    processing: false,
    uncertain: false,
    error: undefined as unknown,
    delivery: {
      error: undefined,
      refetch: async () => {
        calls.reads++;
        return { data: { deliveryStatus: "PENDING" } };
      },
    },
    send: async (...args: unknown[]) => {
      calls.sends.push(args);
      return sendResult;
    },
    retryPrevious: async () => {
      calls.retries++;
      sender.uncertain = false;
      return true;
    },
  };
  const status = {
    data: { fileId: fixtureId(40), generation: 1, state: "READY" },
    error: undefined as unknown,
    isFetching: false,
    refetch: () => latest(),
  };
  const runtime = { key: ["owner"], isCurrent: () => current };
  const mocks: Record<string, Record<string, unknown>> = {
    react: {
      useRef: (value: unknown) => {
        const index = cursor++;
        slots[index] ??= { current: value };
        return slots[index];
      },
      useState: (value: unknown) => {
        const index = cursor++;
        if (!(index in slots)) slots[index] = value;
        return [
          slots[index],
          (next: unknown) => {
            slots[index] = next;
          },
        ];
      },
      useEffect: (effect: () => void) => {
        effects.push(effect);
      },
    },
    "expo-document-picker": {
      getDocumentAsync: async () => {
        calls.choose++;
        return pick();
      },
    },
    "@tanstack/react-query": {
      useQueryClient: () => ({
        setQueryData: (
          _key: unknown,
          update: (previous: typeof status.data) => typeof status.data,
        ) => {
          status.data = update(status.data);
        },
      }),
    },
    "@/features/connections": {
      useConnections: () => runtime,
      useConnectionQuery: () => status,
    },
    "./use-messages-api": {
      useMessagesApi: () => ({
        upload: () => {
          calls.uploads++;
          return upload();
        },
      }),
    },
    "./use-message-send": { useMessageSend: () => sender },
    "../utils/chat-file": {
      chatFormats: { pdf: "application/pdf" },
      validateChatFile: (asset: typeof file) => {
        if (asset.size > 15_000_000) throw new Error("Too large");
      },
      chatFileFormData: (asset: unknown) => asset,
    },
  };
  const contexts = Object.entries(mocks).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  delete local.cache[filename];
  const { useChatAttachment } = local(
    filename,
  ) as typeof import("../src/features/messages/hooks/use-chat-attachment");
  return {
    calls,
    file,
    sender,
    status,
    render() {
      cursor = 0;
      effects = [];
      const result = useChatAttachment(fixtureId(10));
      effects.forEach((effect) => effect());
      return result;
    },
    setPick: (fn: typeof pick) => {
      pick = fn;
    },
    setUpload: (fn: typeof upload) => {
      upload = fn;
    },
    setLatest: (fn: typeof latest) => {
      latest = fn;
    },
    setSendResult: (value: boolean) => {
      sendResult = value;
    },
    expire: () => {
      current = false;
    },
    cleanup() {
      delete local.cache[filename];
      for (const context of contexts.reverse()) context.restore();
    },
  };
}

test("invalid chat attachments retain their specific selection warning instead of a generic failure", () => {
  for (const file of [
    { name: "photo.png", uri: "file:///photo.png", size: 15_000_001 },
    { name: "photo.png", uri: "file:///photo.png", size: 0 },
    {
      name: "photo.png",
      uri: "file:///photo.png",
      size: 100,
      mimeType: "image/jpeg",
    },
  ]) {
    assert.throws(
      () => validateChatFile(file),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal(filePickerError(error, "upload"), error.message);
        assert.notEqual(error.message, "Không thể hoàn tất. Vui lòng thử lại.");
        return true;
      },
    );
  }
});

test("attach opens the device picker immediately, uploads once and retains the existing choice on cancel", async () => {
  const h = harness();
  try {
    const attachment = h.render();
    const first = attachment.choose();
    assert.equal(h.calls.choose, 1, "picker opens directly from the action");
    await attachment.choose();
    await first;
    assert.equal(h.calls.uploads, 1);
    assert.equal(h.render().file?.name, h.file.name);
    assert.equal(h.render().ready, true);
    h.setPick(async () => ({ canceled: true, assets: [] }));
    await h.render().choose();
    assert.equal(h.render().file?.name, h.file.name);
    assert.equal(h.calls.uploads, 1);
  } finally {
    h.cleanup();
  }
});

test("invalid file, upload failure and logout cannot silently send or lose the selected file", async () => {
  const h = harness();
  try {
    h.setPick(async () => ({
      canceled: false,
      assets: [{ ...h.file, size: 15_000_001 }],
    }));
    await h.render().choose();
    assert.equal(h.calls.uploads, 0);
    assert.ok(h.render().error);
    h.setPick(async () => ({ canceled: false, assets: [h.file] }));
    h.setUpload(async () => {
      throw new Error("upload failed");
    });
    await h.render().choose();
    assert.equal(h.render().file?.name, h.file.name);
    assert.equal(h.render().ready, false);
    h.setUpload(async () => ({ fileId: fixtureId(40) }));
    await h.render().retryUpload();
    assert.equal(h.render().ready, true);
    h.expire();
    assert.equal(await h.render().send("caption"), false);
    assert.equal(h.calls.sends.length, 0);
  } finally {
    h.cleanup();
  }
});

test("file send locks selection and duplicate taps across the fresh scan check and sends an empty caption", async () => {
  const h = harness();
  try {
    await h.render().choose();
    let release: () => void = () => {};
    h.setLatest(
      () =>
        new Promise((resolve) => {
          release = () =>
            resolve({ data: { state: "READY" }, error: undefined });
        }),
    );
    const attachment = h.render();
    const sending = attachment.send("");
    assert.equal(await attachment.send("duplicate"), false);
    await attachment.choose();
    attachment.remove();
    assert.ok(h.render().file);
    assert.equal(h.calls.choose, 1);
    release();
    assert.equal(await sending, true);
    assert.equal(await attachment.send("stale repeated tap"), false);
    assert.deepEqual(h.calls.sends, [["", [fixtureId(40)]]]);
    h.render();
    assert.equal(h.render().file, undefined);
  } finally {
    h.cleanup();
  }
});

test("fresh scanner denial or read error retains the file and never publishes", async () => {
  const h = harness();
  try {
    await h.render().choose();
    for (const state of [
      "QUARANTINED",
      "SCANNING",
      "REJECTED",
      "SCAN_FAILED",
      "UPLOAD_FAILED",
      "CLEANUP_PENDING",
      "DELETED",
      "UNKNOWN_FUTURE_STATE",
    ]) {
      h.setLatest(async () => ({ data: { state }, error: undefined }));
      assert.equal(await h.render().send("draft"), false);
      assert.ok(h.render().file);
    }
    h.setLatest(async () => ({
      data: { state: "READY" },
      error: new Error("offline"),
    }));
    assert.equal(await h.render().send("draft"), false);
    assert.equal(h.calls.sends.length, 0);
  } finally {
    h.cleanup();
  }
});

test("automatic file-status updates unlock sending without a manual status tap and ignore other files or an expired owner", async () => {
  const h = harness();
  try {
    await h.render().choose();
    h.status.data.state = "QUARANTINED";
    assert.equal(h.render().ready, false);
    h.render().updateFileStatus([
      { fileId: fixtureId(41), state: "READY", name: "other.pdf" },
    ]);
    assert.equal(h.render().ready, false);
    h.render().updateFileStatus([
      { fileId: fixtureId(40), state: "READY", name: h.file.name },
    ]);
    assert.equal(h.render().ready, true);
    assert.equal(h.calls.sends.length, 0, "status reads never send a message");
    h.expire();
    h.render().updateFileStatus([
      { fileId: fixtureId(40), state: "REJECTED", name: h.file.name },
    ]);
    assert.equal(h.status.data.state, "READY");
  } finally {
    h.cleanup();
  }
});

test("chat attachments check status automatically and only offer retry after an error", () => {
  const local = createRequire(
    new URL(
      "../src/features/messages/components/ChatAttachmentPreview.tsx",
      import.meta.url,
    ),
  );
  const filename = local.resolve("./ChatAttachmentPreview.tsx");
  const jsx = (type: unknown, props: unknown) => ({ type, props });
  let checkError: unknown;
  const mocks = {
    react: {
      useState: () => [
        checkError,
        (value: unknown) => {
          checkError = value;
        },
      ],
    },
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "Fragment" },
    "react-native": {
      View: "View",
      StyleSheet: { create: (value: unknown) => value },
    },
    "@/components/Button": { Button: "Button" },
    "@/components/FormNotice": { FormNotice: "Notice" },
    "@/components/automatic-file-status": {
      AutomaticFileStatus: "AutomaticFileStatus",
    },
    "@/features/connections": { ConnectionFeedback: "Feedback" },
    "./ChatAttachmentTile": { ChatAttachmentTile: "Tile" },
  };
  const contexts = Object.entries(mocks).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  type Element = { type: unknown; props: Record<string, unknown> };
  const elements = (value: unknown): Element[] => {
    if (Array.isArray(value)) return value.flatMap(elements);
    if (!value || typeof value !== "object" || !("props" in value)) return [];
    const element = value as Element;
    return [element, ...elements(element.props.children)];
  };
  let uploads = 0,
    checks = 0;
  const attachment = {
    file: { name: "photo.png", uri: "file:///photo.png" },
    uploaded: true,
    ready: false,
    locked: false,
    pending: false,
    processing: false,
    uncertain: false,
    publicationFailed: false,
    error: undefined as unknown,
    status: {
      data: { fileId: fixtureId(40), state: "QUARANTINED" },
      error: undefined as unknown,
      isFetching: false,
      refetch: () => {
        checks++;
      },
    },
    isCurrent: () => true,
    readFileStatus() {},
    updateFileStatus() {},
    remove() {},
    retryUpload: () => {
      uploads++;
    },
  };
  try {
    delete local.cache[filename];
    const { ChatAttachmentPreview } = local(
      filename,
    ) as typeof import("../src/features/messages/components/ChatAttachmentPreview");
    const render = () =>
      elements(
        ChatAttachmentPreview({
          attachment: attachment as unknown as Parameters<
            typeof ChatAttachmentPreview
          >[0]["attachment"],
          onRecovered() {},
        }),
      );
    assert.equal(render().filter((item) => item.type === "Button").length, 0);
    const monitor = render().find(
      (item) => item.type === "AutomaticFileStatus",
    )!;
    assert.equal(monitor.props.enabled, true);
    assert.deepEqual(monitor.props.files, [
      { fileId: fixtureId(40), state: "QUARANTINED", name: "photo.png" },
    ]);
    (monitor.props.onError as (message?: string) => void)(
      "Máy chủ chưa xử lý được tệp.",
    );
    assert.equal(
      render().find((item) => item.type === "Tile")!.props.status,
      "Chưa kiểm tra được tệp",
    );
    attachment.status.data.fileId = fixtureId(41);
    assert.equal(
      render().find((item) => item.type === "Tile")!.props.status,
      "Đang xử lý…",
      "errors from a previous file do not follow the next selection",
    );
    attachment.status.data.fileId = fixtureId(40);
    (monitor.props.onError as (message?: string) => void)(undefined);
    attachment.ready = true;
    assert.equal(render().filter((item) => item.type === "Button").length, 0);
    attachment.ready = false;
    attachment.processing = true;
    assert.equal(
      render().filter((item) => item.type === "Button").length,
      0,
      "a normal pending delivery has no manual check button",
    );
    attachment.processing = false;
    attachment.locked = true;
    attachment.uncertain = true;
    assert.equal(
      render().find((item) => item.type === "AutomaticFileStatus")!.props
        .enabled,
      true,
      "recovery keeps the file locked but allows read-only scan monitoring",
    );
    attachment.uncertain = false;
    assert.equal(
      render().find((item) => item.type === "AutomaticFileStatus")!.props
        .enabled,
      false,
      "other locks still pause file checks",
    );
    attachment.locked = false;
    attachment.uploaded = false;
    attachment.error = new AppError("http", 503, "FILE_STORAGE_UNAVAILABLE");
    assert.equal(
      render().find((item) => item.type === "Tile")!.props.status,
      "Chưa tải được tệp lên",
    );
    assert.ok(
      render().some(
        (item) =>
          item.type === "Notice" &&
          item.props.children ===
            "Kho lưu trữ tệp đang không khả dụng. Vui lòng thử lại sau.",
      ),
    );
    const retry = render().find((item) => item.type === "Button")!;
    assert.equal(retry.props.children, "Thử lại");
    (retry.props.onPress as () => void)();
    assert.equal(uploads, 1);
    attachment.uploaded = true;
    attachment.error = undefined;
    attachment.status.error = new AppError("http", 500);
    assert.equal(
      render().find((item) => item.type === "Tile")!.props.status,
      "Chưa kiểm tra được tệp",
    );
    assert.ok(
      render().some(
        (item) =>
          item.type === "Notice" &&
          item.props.children ===
            "Máy chủ chưa xử lý được tệp. Vui lòng thử lại sau.",
      ),
    );
    assert.equal(
      render().find((item) => item.type === "AutomaticFileStatus")!.props
        .enabled,
      false,
    );
    (
      render().find((item) => item.type === "Button")!.props
        .onPress as () => void
    )();
    assert.equal(checks, 1);
  } finally {
    delete local.cache[filename];
    contexts.reverse().forEach((context) => context.restore());
  }
});

test("uncertain send preserves its caption and file until manual recovery; 202 remains pending", async () => {
  const h = harness();
  try {
    await h.render().choose();
    h.setSendResult(false);
    assert.equal(await h.render().send("original caption"), false);
    h.sender.uncertain = true;
    const unknown = h.render();
    unknown.remove();
    await unknown.choose();
    assert.equal(h.calls.choose, 1);
    assert.ok(h.render().file);
    assert.equal(await h.render().retry(), "original caption");
    assert.equal(h.calls.retries, 1);
    assert.equal(h.calls.sends.length, 1);
    h.render();
    assert.equal(h.render().file, undefined);
    await h.render().choose();
    h.sender.processing = true;
    assert.equal(await h.render().retry(), undefined);
    assert.equal(
      h.calls.reads,
      1,
      "processing recovery reads delivery without another POST",
    );
    assert.ok(h.render().file);
  } finally {
    h.cleanup();
  }
});
