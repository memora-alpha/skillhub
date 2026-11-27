import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { createRequire } from "node:module";
import { PassThrough } from "node:stream";
import { test } from "node:test";
import { MediaTextExtractor } from "../../dist/modules/content-moderation/infrastructure/media-text-extractor.js";
import sharp from "sharp";

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

test("a worker limits simultaneous Tesseract processes and discards an aborted queued page", async (t) => {
  const running = [];
  const spawn = t.mock.method(
    require("node:child_process"),
    "spawn",
    (_command, args) => {
      const child = Object.assign(new EventEmitter(), {
        stdin: new PassThrough(),
        stdout: new PassThrough(),
      });
      const finish = (text) => {
        child.stdout.end(text);
        child.emit("close", 0);
      };
      if (args[0] === "--list-langs")
        queueMicrotask(() => finish("eng\nvie\n"));
      else running.push(finish);
      return child;
    },
  );
  const extractor = new MediaTextExtractor({
    get: (name, fallback) =>
      name === "CONTENT_MODERATION_OCR_CONCURRENCY" ? 1 : fallback,
  });
  const first = extractor.ocr(Buffer.from("first"));
  const abort = new AbortController();
  const queued = extractor.ocr(Buffer.from("second"), abort.signal);
  const third = extractor.ocr(Buffer.from("third"));
  await new Promise(setImmediate);
  assert.equal(running.length, 1);
  abort.abort();
  await assert.rejects(queued, { name: "AbortError" });
  running[0]("recognized first page");
  assert.equal(await first, "recognized first page");
  await new Promise(setImmediate);
  assert.equal(running.length, 2);
  assert.equal(spawn.mock.calls[1].arguments[2].env.OMP_THREAD_LIMIT, "1");
  running[1]("recognized third page");
  assert.equal(await third, "recognized third page");
});

test("only a fully white rendered page can skip OCR", async () => {
  const extractor = new MediaTextExtractor({
    get: (_name, fallback) => fallback,
  });
  const raw = { width: 2, height: 2, channels: 3 };
  const pixels = Buffer.alloc(12, 255);
  assert.equal(
    await extractor.isBlankPdfPage(
      await sharp(pixels, { raw }).png().toBuffer(),
    ),
    true,
  );
  pixels[0] = 254;
  assert.equal(
    await extractor.isBlankPdfPage(
      await sharp(pixels, { raw }).png().toBuffer(),
    ),
    false,
  );
});
