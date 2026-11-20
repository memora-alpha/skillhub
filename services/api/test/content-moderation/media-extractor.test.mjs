import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { createRequire } from "node:module";
import { PassThrough } from "node:stream";
import { test } from "node:test";
import { MediaTextExtractor } from "../../dist/modules/content-moderation/infrastructure/media-text-extractor.js";

const require = createRequire(import.meta.url);

test("OCR refuses to run with an English-only Tesseract installation", async (t) => {
  const spawn = t.mock.method(require("node:child_process"), "spawn", () => {
    const child = Object.assign(new EventEmitter(), {
      stdin: new PassThrough(),
      stdout: new PassThrough(),
    });
    queueMicrotask(() => {
      child.stdout.end("List of available languages (1):\neng\n");
      child.emit("close", 0);
    });
    return child;
  });
  const extractor = new MediaTextExtractor({
    get: (_name, fallback) => fallback,
  });
  await assert.rejects(extractor.ocr(Buffer.from("image")), {
    message: "MODERATION_OCR_LANGUAGES_UNAVAILABLE",
  });
  assert.equal(spawn.mock.calls.length, 1);
  assert.deepEqual(spawn.mock.calls[0].arguments[1], ["--list-langs"]);
});
