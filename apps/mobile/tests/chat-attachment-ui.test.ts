import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import type { ChatFile } from "../src/features/messages/utils/chat-file";
import { FileSelectionError } from "../src/lib/http/picked-image";
import type { ImagePickerAsset } from "expo-image-picker";

function harness() {
  const local = createRequire(
    new URL(
      "../src/features/messages/hooks/use-chat-attachment.ts",
      import.meta.url,
    ),
  );
  const filename = local.resolve("./use-chat-attachment.ts");
  const slots: unknown[] = [];
  let cursor = 0,
    current = true;
  const file: ChatFile = {
    name: "lesson.pdf",
    uri: "file:///fixture",
    size: 100,
    mimeType: "application/pdf",
  };
  let pick = async () => ({ canceled: false, assets: [file] });
  const photo: ImagePickerAsset = {
    uri: "file:///photo.jpg",
    width: 800,
    height: 600,
    fileName: "photo.HEIC",
    mimeType: "image/jpeg",
    fileSize: 200,
  };
  let pickPhoto = async (): Promise<{
    canceled: boolean;
    assets: ImagePickerAsset[];
  }> => ({ canceled: false, assets: [photo] });
  const picks = {
    photos: [] as Record<string, unknown>[],
    files: [] as Record<string, unknown>[],
  };
  const sent: unknown[] = [];
  const cleanups: (() => void)[] = [];
  let compress = async (file: ChatFile): Promise<ChatFile> => file;
  let paste = async (): Promise<ChatFile> => ({
    ...file,
    name: "pasted.png",
    mimeType: "image/png",
  });
  const outbox = {
    attachmentReady: true,
    offline: false,
    sendAttachment: (text: string, selected: ChatFile) => {
      sent.push({ text, file: selected });
      return true;
    },
  };
  const mocks = {
    react: {
      useEffect: (effect: () => () => void) => {
        const i = cursor++;
        if (!(i in slots)) {
          slots[i] = true;
          cleanups.push(effect());
        }
      },
      useRef: (value: unknown) => {
        const i = cursor++;
        return (slots[i] ??= { current: value });
      },
      useState: (value: unknown) => {
        const i = cursor++;
        if (!(i in slots)) slots[i] = value;
        return [
          slots[i],
          (next: unknown) => {
            slots[i] = next;
          },
        ];
      },
    },
    "react-native": { Platform: { OS: "ios" } },
    "expo-file-system": {
      File: class {
        size = 300;
      },
    },
    "expo-document-picker": {
      getDocumentAsync: (options: Record<string, unknown>) => {
        picks.files.push(options);
        return pick();
      },
    },
    "expo-image-picker": {
      launchImageLibraryAsync: (options: Record<string, unknown>) => {
        picks.photos.push(options);
        return pickPhoto();
      },
      UIImagePickerPreferredAssetRepresentationMode: {
        Compatible: "compatible",
      },
    },
    "@/features/connections": {
      useConnections: () => ({ isCurrent: () => current }),
    },
    "../context/ChatOutbox": { useChatOutbox: () => outbox },
    "../utils/prepare-chat-image": {
      CHAT_IMAGE_COMPRESSION_BYTES: 1_000_000,
      prepareChatImage: (file: ChatFile) => compress(file),
    },
    "../utils/import-pasted-chat-image": {
      importPastedChatImage: () => paste(),
    },
  };
  const contexts = Object.entries(mocks).map(([id, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(id)), { namedExports }),
  );
  const pickerFilename = local.resolve("../utils/pick-chat-attachment.ts");
  delete local.cache[pickerFilename];
  delete local.cache[filename];
  const { useChatAttachment } = local(
    filename,
  ) as typeof import("../src/features/messages/hooks/use-chat-attachment");
  return {
    file,
    sent,
    outbox,
    picks,
    photo,
    compress: (next: typeof compress) => {
      compress = next;
    },
    paste: (next: typeof paste) => {
      paste = next;
    },
    pickPhoto: (next: typeof pickPhoto) => {
      pickPhoto = next;
    },
    render() {
      cursor = 0;
      return useChatAttachment("conversation");
    },
    pick: (next: typeof pick) => {
      pick = next;
    },
    expire: () => {
      current = false;
    },
    cleanup() {
      cleanups.forEach((cleanup) => cleanup());
      delete local.cache[filename];
      delete local.cache[pickerFilename];
      contexts.reverse().forEach((c) => c.restore());
    },
  };
}

test("a native paste event uses its selected image; compression keeps instant preview and sends the prepared bytes", async () => {
  const h = harness();
  let finishCompression!: (file: ChatFile) => void;
  const original = {
    ...h.file,
    name: "pasted.jpg",
    mimeType: "image/jpeg",
    size: 2_000_000,
  };
  h.paste(async () => original);
  h.compress(
    () =>
      new Promise((resolve) => {
        finishCompression = resolve;
      }),
  );
  try {
    await h.render().paste({ uris: ["file:///pasted.jpg"] });
    assert.equal(h.render().file, original);
    assert.equal(h.render().preparing, true);
    assert.equal(h.render().send(""), false);
    const smaller = { ...original, uri: "file:///smaller.jpg", size: 500_000 };
    finishCompression(smaller);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(h.render().file, smaller);
    assert.equal(h.render().ready, true);
    assert.equal(h.render().send(""), true);
    assert.deepEqual(h.sent, [{ text: "", file: smaller }]);
    assert.equal(h.sent.length, 1);
  } finally {
    h.cleanup();
  }
});

test("removing a selection disposes late compressed output and cannot replace the new file", async () => {
  const h = harness();
  let finish!: (file: ChatFile) => void;
  let disposed = 0;
  h.paste(async () => ({
    ...h.file,
    name: "pasted.jpg",
    mimeType: "image/jpeg",
    size: 2_000_000,
  }));
  h.compress(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  try {
    await h.render().paste({ uris: ["file:///pasted.jpg"] });
    h.render().remove();
    await h.render().choose("photos");
    finish({
      ...h.file,
      uri: "file:///old-compressed",
      cleanup: () => {
        disposed++;
      },
    });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(disposed, 1);
    assert.equal(h.render().file?.uri, h.photo.uri);
    assert.equal(h.render().ready, true);
    assert.equal(h.render().send("caption"), true);
  } finally {
    h.cleanup();
  }
});

test("picking only selects a file; Send transfers it to the outbox immediately and blocks duplicate taps", async () => {
  const h = harness();
  try {
    await h.render().choose();
    assert.equal(h.sent.length, 0);
    assert.equal(h.render().file?.name, h.file.name);
    const selected = h.render();
    assert.equal(selected.ready, true);
    assert.equal(selected.send("caption"), true);
    assert.equal(selected.send("caption"), false);
    assert.equal(h.render().file, undefined);
    assert.deepEqual(h.sent, [{ text: "caption", file: h.file }]);
    await h.render().choose();
    assert.equal(
      h.render().send(""),
      true,
      "a second explicit file send needs no caption",
    );
  } finally {
    h.cleanup();
  }
});

test("photos use the library, show a thumbnail and retain their converted MIME and size before sending", async () => {
  const h = harness();
  try {
    await h.render().choose("photos");
    assert.equal(h.picks.files.length, 0);
    assert.equal(h.picks.photos.length, 1);
    assert.deepEqual(h.picks.photos[0]?.mediaTypes, ["images"]);
    assert.equal(h.picks.photos[0]?.allowsEditing, false);
    assert.equal(h.sent.length, 0);
    assert.equal(h.render().file?.name, "photo.jpg");
    assert.equal(h.render().file?.mimeType, "image/jpeg");
    assert.equal(h.render().file?.previewUri, h.photo.uri);
    assert.equal(h.render().file?.size, 200);
    assert.equal(h.render().send(""), true);
    assert.equal(h.render().send(""), false);
    assert.equal(h.sent.length, 1);
    assert.equal(h.render().file, undefined);
  } finally {
    h.cleanup();
  }
});

test("files filter to chat documents, while gallery cancellation, unsupported images and missing sizes are handled safely", async () => {
  const h = harness();
  try {
    await h.render().choose("files");
    assert.deepEqual(h.picks.files[0]?.type, [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
    ]);
    h.pickPhoto(async () => ({ canceled: true, assets: [] }));
    await h.render().choose("photos");
    assert.equal(h.render().file, h.file);
    h.pickPhoto(async () => ({
      canceled: false,
      assets: [{ ...h.photo, mimeType: "image/heic" }],
    }));
    await h.render().choose("photos");
    assert.ok(h.render().error instanceof FileSelectionError);
    assert.equal(h.render().file, h.file);
    h.pickPhoto(async () => ({
      canceled: false,
      assets: [{ ...h.photo, fileSize: undefined }],
    }));
    await h.render().choose("photos");
    assert.equal(h.render().file?.size, 300);
    assert.equal(h.render().error, undefined);
  } finally {
    h.cleanup();
  }
});

test("picker cancel and invalid selections retain the earlier valid file and show the selection error", async () => {
  const h = harness();
  try {
    await h.render().choose();
    h.pick(async () => ({ canceled: true, assets: [] }));
    await h.render().choose();
    assert.equal(h.render().file, h.file);
    h.pick(async () => ({
      canceled: false,
      assets: [{ ...h.file, name: "bad.exe" }],
    }));
    await h.render().choose();
    assert.ok(h.render().error instanceof FileSelectionError);
    assert.equal(h.render().file, h.file);
    h.render().remove();
    assert.equal(h.render().file, undefined);
  } finally {
    h.cleanup();
  }
});

test("an open photo library blocks a second picker and an expired account cannot retain its result", async () => {
  const h = harness();
  let finish!: (value: {
    canceled: boolean;
    assets: ImagePickerAsset[];
  }) => void;
  h.pickPhoto(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  try {
    const pending = h.render().choose("photos");
    await h.render().choose("files");
    assert.equal(h.picks.photos.length, 1);
    assert.equal(h.picks.files.length, 0);
    assert.equal(h.render().send("draft"), false);
    h.expire();
    finish({ canceled: false, assets: [h.photo] });
    await pending;
    assert.equal(h.render().file, undefined);
    assert.equal(h.sent.length, 0);
  } finally {
    h.cleanup();
  }
});

test("offline, unhydrated storage, picker in flight and expired owners cannot enqueue or clear the draft", async () => {
  const h = harness();
  try {
    await h.render().choose();
    h.outbox.offline = true;
    assert.equal(h.render().send("draft"), false);
    assert.equal(h.render().file, h.file);
    h.outbox.offline = false;
    h.outbox.attachmentReady = false;
    assert.equal(h.render().send("draft"), false);
    h.outbox.attachmentReady = true;
    let finish!: (value: { canceled: boolean; assets: ChatFile[] }) => void;
    h.pick(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const pending = h.render().choose();
    assert.equal(h.render().send("draft"), false);
    h.expire();
    finish({ canceled: false, assets: [h.file] });
    await pending;
    assert.equal(h.render().send("draft"), false);
    assert.equal(h.sent.length, 0);
  } finally {
    h.cleanup();
  }
});
