import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";

test("native save picks destination before transfer, uses snapshot filename and removes temporary/partial files", async () => {
  const local = createRequire(
    new URL(
      "../src/features/materials/utils/save-material-file.ts",
      import.meta.url,
    ),
  );
  const file = local.resolve("./save-material-file.ts");
  const events: string[] = [];
  let cancelled = false,
    failCopy = false;
  const saved = {
    exists: true,
    delete: () => {
      events.push("delete-partial");
      saved.exists = false;
    },
  };
  class Directory {
    exists = true;
    static async pickDirectoryAsync() {
      events.push("pick");
      if (cancelled) throw new Error("User cancelled");
      return new Directory();
    }
    create() {
      events.push("mkdir-temp");
    }
    createFile(name: string, mime: string | null) {
      events.push(`create:${name}:${mime}`);
      saved.exists = true;
      return saved;
    }
    delete() {
      events.push("delete-temp");
      this.exists = false;
    }
  }
  const contexts = Object.entries({
    "expo-file-system": {
      Directory,
      Paths: { cache: "file:///cache/" },
      File: {
        downloadFileAsync: async (
          _url: string,
          _directory: unknown,
          options: { signal: AbortSignal },
        ) => {
          options.signal.throwIfAborted();
          events.push("transfer");
          return {
            name: "purchased-snapshot.pdf",
            type: "application/pdf",
            copy: async (_target: unknown, options: { overwrite: boolean }) => {
              assert.equal(options.overwrite, true);
              events.push("copy");
              if (failCopy) throw new Error("Disk full");
            },
          };
        },
      },
    },
    "expo-crypto": { randomUUID: () => "fixed-id-for-save" },
  }).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  try {
    delete local.cache[file];
    const { prepareMaterialDownload } = local(file);
    cancelled = true;
    assert.equal(await prepareMaterialDownload(), undefined);
    assert.deepEqual(events, ["pick"]);
    cancelled = false;
    events.length = 0;
    const target = await prepareMaterialDownload();
    assert.deepEqual(events, ["pick"]);
    await target(
      "https://files.example.test/signed",
      new AbortController().signal,
    );
    assert.deepEqual(events, [
      "pick",
      "mkdir-temp",
      "transfer",
      "create:fixed-id-purchased-snapshot.pdf:application/pdf",
      "copy",
      "delete-temp",
    ]);
    events.length = 0;
    failCopy = true;
    await assert.rejects(
      target("https://files.example.test/signed", new AbortController().signal),
    );
    assert.ok(events.includes("delete-partial"));
    assert.ok(events.includes("delete-temp"));
  } finally {
    contexts.reverse().forEach((context) => context.restore());
    delete local.cache[file];
  }
});
