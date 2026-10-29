import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import { fixtureId } from "./fixtures/learning-requests-data";

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
    data: { state: "READY" },
    error: undefined as unknown,
    isFetching: false,
    refetch: () => latest(),
  };
  const runtime = { isCurrent: () => current };
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
