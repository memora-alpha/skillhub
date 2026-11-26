import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { Readable } from "node:stream";
import { FileContentModeration } from "../../dist/infrastructure/storage/file-content-moderation.js";
import { ConfigService } from "@nestjs/config";
import { ContentModerationService } from "../../dist/modules/content-moderation/application/content-moderation.service.js";
import { MediaModerationService } from "../../dist/modules/content-moderation/application/media-moderation.service.js";
import { Prisma } from "../../dist/generated/prisma/client.js";

test("enforces keywords from media OCR even without an available AI provider", async () => {
  for (const mode of ["off", "observe", "enforce"]) {
    const moderation = new ContentModerationService(
      new ConfigService({ CONTENT_MODERATION_MODES: `media:${mode}` }),
      {
        classify: async () => {
          throw new Error("offline");
        },
      },
    );
    const service = new MediaModerationService(moderation, {
      canonicalImage: async (bytes) => bytes,
      ocr: async () => "địt mẹ",
    });
    const result = await service.assess({
      surface: "media",
      mime: "image/png",
      version: "1",
      digest: "fixed",
      bytes: Buffer.from("fixture"),
    });
    assert.equal(result.outcome, "BLOCK", mode);
    assert.equal(result.observedOutcome, undefined);
  }
});

test("an AI result on the filename or first PDF page cannot bypass local screening", async () => {
  for (const mode of ["observe", "enforce"]) {
    const moderation = new ContentModerationService(
      new ConfigService({ CONTENT_MODERATION_MODES: `media:${mode}` }),
      {
        classify: async () => {
          throw new Error("offline");
        },
      },
    );
    const service = new MediaModerationService(moderation, {
      pdfPageCount: async () => 2,
      pdfText: async () => "",
      pdfPage: async (_bytes, page) =>
        Buffer.from(page === 1 ? "intro" : "đù má"),
      ocr: async (bytes) => bytes.toString(),
    });
    const result = await service.assess({
      surface: "media",
      mime: "application/pdf",
      version: "1",
      digest: "fixed",
      filename: "document.pdf",
      bytes: Buffer.from("fixture"),
    });
    assert.equal(result.outcome, "BLOCK", mode);
    assert.equal(result.observedOutcome, undefined);
  }
});

test("media cannot approve an image until visual and extracted text checks both pass", async () => {
  const seen = [];
  const service = new MediaModerationService(
    {
      mode: () => "enforce",
      evaluateAi: async (input) => {
        seen.push(input);
        return {
          outcome: input.text?.includes("threat") ? "BLOCK" : "ALLOW",
          sourceVersion: input.sourceVersion,
          digest: input.digest,
          reasonCodes: [],
          policyVersion: "fixture",
        };
      },
    },
    {
      canonicalImage: async (contents) => contents,
      ocr: async () => "threat text found in image",
    },
  );
  const outcome = await service.assess({
    surface: "media",
    mime: "image/png",
    version: "2",
    digest: "checksum",
    filename: "screenshot.png",
    bytes: Buffer.from("fixture"),
  });
  assert.equal(outcome.outcome, "BLOCK");
  assert.ok(seen.some((input) => input.image));
  assert.ok(seen.some((input) => input.text?.includes("threat")));
  assert.ok(
    seen.every(
      (input) => input.sourceVersion === "2" && input.digest === "checksum",
    ),
  );
});

test("unsupported office formats and failed image parsing stay in review", async () => {
  const service = new MediaModerationService(
    {
      mode: () => "enforce",
      evaluateAi: async () => ({ outcome: "ALLOW" }),
    },
    {
      canonicalImage: async () => {
        throw new Error("parser details");
      },
    },
  );
  for (const mime of ["image/png", "application/msword"]) {
    const decision = await service.assess({
      surface: "media",
      mime,
      version: "1",
      digest: "fixed",
      filename: "example",
      bytes: Buffer.from("fixture"),
    });
    assert.equal(decision.outcome, "REVIEW");
    assert.doesNotMatch(JSON.stringify(decision), /parser details/);
  }
});

test("checks DOCX text and embedded images before approval", async () => {
  const checked = [];
  const service = new MediaModerationService(
    {
      evaluateAi: async (input) => {
        checked.push(input);
        return {
          outcome: "ALLOW",
          sourceVersion: input.sourceVersion,
          digest: input.digest,
          reasonCodes: [],
        };
      },
    },
    {
      docx: async () => ({
        text: "Bài tập Node.js",
        images: [Buffer.from("image")],
      }),
      canonicalImage: async (bytes) => bytes,
      ocr: async () => "Chữ trong ảnh",
    },
  );
  const result = await service.assess({
    surface: "media",
    version: "1",
    digest: "fixed",
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    bytes: Buffer.from("fixture"),
  });
  assert.equal(result.outcome, "ALLOW");
  assert.ok(checked.some(({ text }) => text === "Bài tập Node.js"));
  assert.ok(checked.some(({ image }) => image));
});

test("an extraction failure holds the file even when AI mode only observes", async () => {
  const service = new MediaModerationService(
    { mode: () => "observe", evaluateAi: async () => ({ outcome: "ALLOW" }) },
    {
      canonicalImage: async () => {
        throw new Error("extractor unavailable");
      },
    },
  );
  const result = await service.assess({
    surface: "media",
    mime: "image/png",
    version: "1",
    digest: "fixed",
    bytes: Buffer.from("fixture"),
  });
  assert.equal(result.outcome, "REVIEW");
});

test("only a clean file of the exact generation and checksum can record a verdict", async () => {
  const contents = Buffer.from("sample file");
  const digest = createHash("sha256").update(contents).digest("hex");
  let written = [];
  const row = {
    id: "file-id",
    generation: 5,
    purpose: "CHAT",
    state: "READY",
    scanVerdict: "CLEAN",
    sha256: digest,
    objectKey: "private/example",
    sizeBytes: contents.length,
    detectedMime: "text/plain",
    originalName: "test.txt",
    moderationAssessment: null,
  };
  const service = new FileContentModeration(
    {
      storedFile: {
        findUnique: async () => row,
        updateMany: async (input) => {
          written.push(input);
          return { count: 1 };
        },
      },
    },
    { read: async () => Readable.from([contents]) },
    { mode: () => "enforce" },
    {
      assess: async (input) => ({
        outcome: "BLOCK",
        sourceVersion: input.version,
        digest: input.digest,
      }),
    },
  );
  await service.process(row.id, 4);
  assert.equal(written.length, 0);
  await service.process(row.id, 5);
  assert.deepEqual(written[0].where, {
    id: row.id,
    generation: 5,
    sha256: digest,
    state: "READY",
    scanVerdict: "CLEAN",
    moderationAssessment: { equals: Prisma.DbNull },
  });
  assert.equal(written[0].data.moderationAssessment.outcome, "BLOCK");
  assert.equal(service.status({ ...row, ...written[0].data }), "REJECTED");
  assert.equal(
    service.status({ ...row, ...written[0].data, generation: 6 }),
    "QUARANTINED",
  );
  written = [];
  await service.process(row.id, 6);
  assert.equal(written.length, 0);
});

test("retries temporary media errors and returns terminal status after exhaustion", async () => {
  const contents = Buffer.from("sample file");
  const row = {
    id: "sample",
    purpose: "CHAT",
    state: "READY",
    generation: 1,
    sha256: createHash("sha256").update(contents).digest("hex"),
    scanVerdict: "CLEAN",
    detectedMime: "image/png",
    sizeBytes: contents.length,
    moderationAssessment: null,
  };
  const service = new FileContentModeration(
    {
      storedFile: {
        findUnique: async () => row,
        updateMany: async ({ data }) => {
          Object.assign(row, data);
          return { count: 1 };
        },
      },
    },
    { read: async () => Readable.from([contents]) },
    { mode: () => "enforce" },
    {
      assess: async (input) => ({
        sourceVersion: input.version,
        digest: input.digest,
        outcome: "RETRY",
        reasonCodes: ["MEDIA_OCR_TIMEOUT"],
      }),
    },
  );
  await assert.rejects(service.process(row.id, 1), {
    message: "FILE_MODERATION_RETRY",
  });
  assert.equal(row.moderationAssessment, null);
  await service.process(row.id, 1, true);
  assert.deepEqual(await service.resolveStatusDetails(row), {
    state: "SCAN_FAILED",
    moderationStatus: "FAILED",
  });
  assert.deepEqual(row.moderationAssessment.reasonCodes, ["MEDIA_OCR_TIMEOUT"]);
});

test("a new policy version queues one recheck identity for the same file and generation", async () => {
  let version = 2;
  const queued = [];
  const service = new FileContentModeration(
    {},
    {},
    { profanityVersion: async () => version },
    {},
    {
      add: async (_name, _data, options) => queued.push(options.jobId),
    },
  );
  const row = {
    id: "sample",
    purpose: "CHAT",
    state: "READY",
    generation: 3,
    sha256: "checksum",
    moderationAssessment: {
      outcome: "ALLOW",
      sourceVersion: "3",
      digest: "checksum",
      profanityVersion: 2,
      policyVersion: "skillhub-content-v2",
      extractorRevision: 2,
    },
  };
  assert.equal(await service.resolveStatus(row), "READY");
  version++;
  assert.equal(await service.resolveStatus(row), "QUARANTINED");
  assert.equal(await service.resolveStatus(row), "QUARANTINED");
  assert.equal(queued.length, 2);
  assert.equal(queued[0], queued[1]);
});

test("invalidates legacy review and observe-only decisions before an enforced send", async () => {
  const jobs = [];
  const service = new FileContentModeration(
    {},
    {},
    { mode: () => "enforce" },
    {},
    {
      add: async (_name, _data, options) => jobs.push(options.jobId),
    },
  );
  const base = {
    id: "file",
    purpose: "CHAT",
    state: "READY",
    generation: 1,
    sha256: "hash",
  };
  const version = { sourceVersion: "1", digest: "hash", profanityVersion: 1 };
  for (const moderationAssessment of [
    { ...version, outcome: "REVIEW", enforced: true },
    { ...version, outcome: "ALLOW", observedOutcome: "BLOCK", enforced: false },
  ]) {
    assert.deepEqual(
      await service.resolveStatusDetails({ ...base, moderationAssessment }),
      {
        state: "QUARANTINED",
        moderationStatus: "PENDING",
      },
    );
  }
  assert.equal(jobs[0], jobs[1]);
});
