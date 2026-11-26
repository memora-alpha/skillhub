import assert from "node:assert/strict";
import { mock, test } from "node:test";

test("native outbox persists the temporary file before replacing saved messages", async (t) => {
  let write: () => Promise<void> = () => Promise.resolve();
  const moves: { destination: unknown; options: unknown }[] = [];
  class Directory {
    create() {}
  }
  class File {
    constructor(
      readonly parent: unknown,
      readonly name: string,
    ) {}
    write() {
      return write();
    }
    move(destination: unknown, options: unknown) {
      moves.push({ destination, options });
    }
  }
  const native = mock.module("react-native", {
    namedExports: { Platform: { OS: "android" } },
  });
  const files = mock.module("expo-file-system", {
    namedExports: { Directory, File, Paths: { document: "document" } },
  });
  try {
    const { createOutboxStorage } =
      await import("../src/features/messages/outbox/outbox-storage");
    await t.test(
      "does not move a file while its async write is pending",
      async () => {
        let finish!: () => void;
        write = () => new Promise<void>((resolve) => (finish = resolve));
        const storage = createOutboxStorage("owner", "scope");
        const pending = storage.write("saved messages");
        await Promise.resolve();
        assert.equal(moves.length, 0);
        finish();
        await pending;
        assert.equal(moves.length, 1);
        assert.ok(moves[0]?.destination instanceof File);
        assert.deepEqual(moves[0]?.options, { overwrite: true });
      },
    );
    await t.test(
      "keeps the existing outbox when writing the replacement fails",
      async () => {
        moves.length = 0;
        const failure = new Error("storage full");
        write = () => Promise.reject(failure);
        const storage = createOutboxStorage("owner", "scope");
        await assert.rejects(storage.write("saved messages"), failure);
        assert.equal(moves.length, 0);
      },
    );
    await t.test(
      "attachments have a separate file and cannot replace text messages",
      async () => {
        moves.length = 0;
        write = () => Promise.resolve();
        await createOutboxStorage("owner", "scope").write("text");
        await createOutboxStorage("owner", "scope", "attachments").write(
          "files",
        );
        const first = moves[0]?.destination as File,
          second = moves[1]?.destination as File;
        assert.notEqual(first.name, second.name);
        moves.length = 0;
        await createOutboxStorage("owner", "scope").write("text again");
        assert.equal(
          (moves[0]?.destination as File).name,
          first.name,
          "the existing text filename stays compatible",
        );
      },
    );
  } finally {
    files.restore();
    native.restore();
  }
});
