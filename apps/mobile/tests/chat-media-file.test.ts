import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";

test("native private previews are disposable; cancelled saves remove bytes and picker cancellation creates nothing", async () => {
  const local = createRequire(
    new URL(
      "../src/features/messages/utils/chat-media-file.ts",
      import.meta.url,
    ),
  );
  const filename = local.resolve("./chat-media-file.ts");
  const files: FakeFile[] = [];
  let cancelled = false;
  let afterWrite = () => {};
  class FakeFile {
    exists = true;
    uri = "file:///private/preview.webp";
    bytes?: Uint8Array;
    constructor() {
      files.push(this);
    }
    write(bytes: Uint8Array) {
      this.bytes = bytes;
      afterWrite();
    }
    delete() {
      this.exists = false;
    }
  }
  class FakeDirectory {
    create() {}
    createFile() {
      return new FakeFile();
    }
    static async pickDirectoryAsync() {
      if (cancelled) throw new Error("User cancelled");
      return new FakeDirectory();
    }
  }
  const contexts = [
    mock.module(pathToFileURL(local.resolve("expo-file-system")), {
      namedExports: {
        File: FakeFile,
        Directory: FakeDirectory,
        Paths: { cache: "file:///cache" },
      },
    }),
    mock.module(pathToFileURL(local.resolve("expo-crypto")), {
      namedExports: { randomUUID: () => "fixture" },
    }),
  ];
  try {
    delete local.cache[filename];
    const { createChatMediaFile, prepareChatDownload } = local(
      filename,
    ) as typeof import("../src/features/messages/utils/chat-media-file");
    const bytes = new Uint8Array([1, 2, 3]);
    const preview = createChatMediaFile(bytes, "image/webp");
    assert.equal(files[0]!.bytes, bytes);
    preview.dispose();
    preview.dispose();
    assert.equal(files[0]!.exists, false);
    const save = await prepareChatDownload("lesson.pdf", "application/pdf");
    const control = new AbortController();
    afterWrite = () => control.abort();
    await assert.rejects(save!(bytes, control.signal));
    assert.equal(
      files[1]!.exists,
      false,
      "aborted output cannot remain in the selected directory",
    );
    cancelled = true;
    assert.equal(
      await prepareChatDownload("photo.webp", "image/webp"),
      undefined,
    );
    assert.equal(files.length, 2);
  } finally {
    delete local.cache[filename];
    contexts.reverse().forEach((context) => context.restore());
  }
});

test("web previews revoke their object URLs and aborted saves never trigger a download", async () => {
  const { createChatMediaFile, prepareChatDownload } =
    await import("../src/features/messages/utils/chat-media-file.web");
  const revoked: string[] = [];
  const create = mock.method(URL, "createObjectURL", () => "blob:private");
  const revoke = mock.method(URL, "revokeObjectURL", (uri: string) => {
    revoked.push(uri);
  });
  try {
    const preview = createChatMediaFile(new Uint8Array([1]), "image/png");
    preview.dispose();
    assert.deepEqual(revoked, ["blob:private"]);
    const control = new AbortController();
    control.abort();
    const save = await prepareChatDownload("lesson.pdf", "application/pdf");
    await assert.rejects(save(new Uint8Array([1]), control.signal));
    assert.equal(create.mock.calls.length, 1);
  } finally {
    create.mock.restore();
    revoke.mock.restore();
  }
});
