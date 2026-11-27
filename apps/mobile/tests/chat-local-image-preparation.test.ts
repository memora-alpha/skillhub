import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";

test("native paste imports only one supported local image, validates before copying and owns its disposable cache copy", async () => {
  const local = createRequire(
    new URL(
      "../src/features/messages/utils/import-pasted-chat-image.ts",
      import.meta.url,
    ),
  );
  const filename = local.resolve("./import-pasted-chat-image.ts");
  const files: FakeFile[] = [];
  class FakeFile {
    uri: string;
    name: string;
    exists = false;
    size = 10;
    constructor(...parts: string[]) {
      this.uri = parts.join("/");
      this.name = parts.at(-1)!.split("/").at(-1)!;
      files.push(this);
    }
    copy(destination: FakeFile) {
      destination.exists = true;
    }
    delete() {
      this.exists = false;
    }
  }
  const contexts = [
    mock.module(pathToFileURL(local.resolve("expo-file-system")), {
      namedExports: { File: FakeFile, Paths: { cache: "file:///cache" } },
    }),
    mock.module(pathToFileURL(local.resolve("expo-crypto")), {
      namedExports: { randomUUID: () => "fixture" },
    }),
  ];
  try {
    delete local.cache[filename];
    const { importPastedChatImage } = local(
      filename,
    ) as typeof import("../src/features/messages/utils/import-pasted-chat-image");
    await assert.rejects(importPastedChatImage({ uris: [] }), /một ảnh/);
    await assert.rejects(
      importPastedChatImage({ uris: ["file:///a.png", "file:///b.png"] }),
      /một ảnh/,
    );
    await assert.rejects(
      importPastedChatImage({ uris: ["https://example.com/a.png"] }),
      /Không đọc được/,
    );
    assert.equal(files.length, 0);
    await assert.rejects(
      importPastedChatImage({ uris: ["file:///a.gif"] }),
      /JPG, PNG hoặc WebP/,
    );
    const selected = await importPastedChatImage({
      uris: ["file:///clipboard.png"],
    });
    assert.equal(selected.uri, "file:///cache/chat-paste-fixture.png");
    assert.equal(selected.previewUri, selected.uri);
    assert.equal(files.at(-1)!.exists, true);
    selected.cleanup?.();
    assert.equal(files.at(-1)!.exists, false);
  } finally {
    delete local.cache[filename];
    contexts.reverse().forEach((context) => context.restore());
  }
});

test("compression preserves dimensions and alpha, keeps smaller outputs, and falls back on encoder failure", async () => {
  const local = createRequire(
    new URL(
      "../src/features/messages/utils/prepare-chat-image.ts",
      import.meta.url,
    ),
  );
  const filename = local.resolve("./prepare-chat-image.ts");
  let size = 500_000,
    broken = false;
  const saved: unknown[] = [];
  const files: FakeFile[] = [];
  class FakeFile {
    uri = "file:///compressed";
    exists = true;
    size = size;
    constructor() {
      files.push(this);
    }
    delete() {
      this.exists = false;
    }
  }
  const context = {
    renderAsync: async () => {
      if (broken) throw new Error("encoder failed");
      return {
        saveAsync: async (options: unknown) => {
          saved.push(options);
          return { uri: "file:///compressed" };
        },
        release() {},
      };
    },
    release() {},
  };
  const contexts = [
    mock.module(pathToFileURL(local.resolve("expo-image-manipulator")), {
      namedExports: {
        ImageManipulator: { manipulate: () => context },
        SaveFormat: { JPEG: "jpeg", PNG: "png" },
      },
    }),
    mock.module(pathToFileURL(local.resolve("expo-file-system")), {
      namedExports: { File: FakeFile },
    }),
  ];
  try {
    delete local.cache[filename];
    const { prepareChatImage } = local(
      filename,
    ) as typeof import("../src/features/messages/utils/prepare-chat-image");
    const original = {
      name: "photo.jpg",
      uri: "file:///original",
      mimeType: "image/jpeg",
      size: 2_000_000,
    };
    const control = new AbortController();
    const smaller = await prepareChatImage(original, control.signal);
    assert.equal(smaller.size, 500_000);
    assert.deepEqual(saved[0], {
      format: "jpeg",
      compress: 0.85,
      base64: false,
    });
    smaller.cleanup?.();
    assert.equal(files[0]!.exists, false);
    size = 3_000_000;
    const transparent = {
      ...original,
      name: "photo.png",
      mimeType: "image/png",
    };
    assert.equal(
      await prepareChatImage(transparent, control.signal),
      transparent,
    );
    assert.deepEqual(saved[1], { format: "png", compress: 1, base64: false });
    assert.equal(files[1]!.exists, false, "a larger candidate is deleted");
    const webp = {
      ...original,
      name: "animation.webp",
      mimeType: "image/webp",
    };
    assert.equal(
      await prepareChatImage(webp, control.signal),
      webp,
      "keep WebP animation instead of flattening it into PNG",
    );
    assert.equal(saved.length, 2);
    broken = true;
    assert.equal(await prepareChatImage(original, control.signal), original);
    control.abort();
    broken = false;
    assert.equal(await prepareChatImage(original, control.signal), original);
  } finally {
    delete local.cache[filename];
    contexts.reverse().forEach((context) => context.restore());
  }
});
