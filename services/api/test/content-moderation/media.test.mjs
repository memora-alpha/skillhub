import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { Readable } from "node:stream";
import { FileContentModeration } from "../../dist/infrastructure/storage/file-content-moderation.js";
import { ConfigService } from "@nestjs/config";
import { ContentModerationService } from "../../dist/modules/content-moderation/application/content-moderation.service.js";
import { MediaModerationService } from "../../dist/modules/content-moderation/application/media-moderation.service.js";
import { MediaExtractionError } from "../../dist/modules/content-moderation/infrastructure/media-text-extractor.js";
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
      isBlankPdfPage: async () => false,
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

test("a PDF OCR timeout retries only that page and still checks later visible text", async () => {
  const rendered = [];
  const recognized = [];
  const checked = [];
  const service = new MediaModerationService(
    {
      evaluateAi: async (input) => {
        checked.push(input.text);
        return {
          outcome:
            input.text === "blocked in the last page" ? "BLOCK" : "ALLOW",
          reasonCodes: [],
        };
      },
    },
    {
      pdfPageCount: async () => 3,
      isBlankPdfPage: async () => false,
      pdfText: async () => "A benign text layer",
      pdfPage: async (_bytes, page) => {
        rendered.push(page);
        return Buffer.from(String(page));
      },
      ocr: async (bytes) => {
        const page = Number(bytes.toString());
        recognized.push(page);
        if (
          page === 2 &&
          recognized.filter((value) => value === 2).length === 1
        )
          throw new MediaExtractionError("MEDIA_OCR_TIMEOUT", true);
        return page === 3
          ? "blocked in the last page"
          : `text from page ${page}`;
      },
    },
  );
  const result = await service.assess({
    surface: "media",
    mime: "application/pdf",
    version: "1",
    digest: "pdf",
    bytes: Buffer.from("fixture"),
  });
  assert.equal(result.outcome, "BLOCK");
  assert.deepEqual(rendered, [1, 2, 3]);
  assert.deepEqual(recognized, [1, 2, 2, 3]);
  assert.ok(checked.includes("A benign text layer"));
});

test("exhausted OCR retries stay fail-closed without restarting the whole PDF", async () => {
  let ocrAttempts = 0;
  const service = new MediaModerationService(
    { evaluateAi: async () => ({ outcome: "ALLOW", reasonCodes: [] }) },
    {
      pdfPageCount: async () => 1,
      isBlankPdfPage: async () => false,
      pdfText: async () => "A benign text layer",
      pdfPage: async () => Buffer.from("page"),
      ocr: async () => {
        ocrAttempts++;
        throw new MediaExtractionError("MEDIA_OCR_TIMEOUT", true);
      },
    },
  );
  const result = await service.assess({
    surface: "media",
    mime: "application/pdf",
    version: "1",
    digest: "pdf",
    bytes: Buffer.from("fixture"),
  });
  assert.equal(ocrAttempts, 2);
  assert.equal(result.outcome, "REVIEW");
  assert.deepEqual(result.reasonCodes, ["MEDIA_OCR_TIMEOUT"]);
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

test("an expired chat PDF budget does not start another assessment", async () => {
  let objectReads = 0;
  const row = {
    id: "file-id",
    purpose: "CHAT",
    state: "READY",
    generation: 1,
    sha256: "pdf-hash",
    scanVerdict: "CLEAN",
    detectedMime: "application/pdf",
    sizeBytes: 6,
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
    {
      read: async () => {
        objectReads++;
        return Readable.from(["sample"]);
      },
    },
    { mode: () => "enforce" },
    {
      assess: async () => {
        throw new Error("The job already expired");
      },
    },
  );
  await service.process(
    row.id,
    row.generation,
    false,
    new AbortController().signal,
    1,
    Date.now() - 121_000,
  );
  assert.equal(objectReads, 0);
  assert.equal(row.moderationAssessment.outcome, "FAILED");
  assert.deepEqual(row.moderationAssessment.reasonCodes, [
    "MEDIA_PROCESSING_TIMEOUT",
  ]);
});

test("a redelivered old worker job cannot overwrite an explicit attachment retry", async () => {
  const row = {
    id: "file-id",
    purpose: "CHAT",
    state: "READY",
    generation: 1,
    sha256: "pdf-hash",
    scanVerdict: "CLEAN",
    detectedMime: "application/pdf",
    sizeBytes: 6,
    moderationAssessment: {
      outcome: "PENDING",
      retryAttemptId: "new-retry",
      retryQueuedAt: Date.now(),
    },
  };
  let writes = 0;
  const service = new FileContentModeration(
    {
      storedFile: {
        findUnique: async () => row,
        updateMany: async ({ data }) => {
          writes++;
          Object.assign(row, data);
          return { count: 1 };
        },
      },
    },
    {},
    { mode: () => "enforce" },
    {},
  );
  const expiredAt = Date.now() - 121_000;
  await service.process(
    row.id,
    1,
    true,
    new AbortController().signal,
    1,
    expiredAt,
  );
  assert.equal(row.moderationAssessment.retryAttemptId, "new-retry");
  assert.equal(writes, 0);
  await service.process(
    row.id,
    1,
    true,
    new AbortController().signal,
    1,
    expiredAt,
    "new-retry",
  );
  assert.equal(row.moderationAssessment.outcome, "FAILED");
  assert.equal(writes, 1);
});

test("an approval that expires during its database update is rolled back", async () => {
  const contents = Buffer.from("a pdf");
  const row = {
    id: "file-id",
    purpose: "CHAT",
    state: "READY",
    generation: 1,
    sha256: createHash("sha256").update(contents).digest("hex"),
    scanVerdict: "CLEAN",
    detectedMime: "application/pdf",
    sizeBytes: contents.length,
    moderationAssessment: null,
  };
  const signal = new AbortController();
  const committed = [];
  const service = new FileContentModeration(
    {
      storedFile: {
        findUnique: async () => row,
        updateMany: async ({ data }) => {
          committed.push(data.moderationAssessment.outcome);
          return { count: 1 };
        },
      },
      $transaction: async (work) => {
        let pending;
        const result = await work({
          $queryRaw: async () => [],
          storedFile: {
            updateMany: async ({ data }) => {
              pending = data.moderationAssessment.outcome;
              signal.abort();
              return { count: 1 };
            },
          },
        });
        committed.push(pending);
        return result;
      },
    },
    { read: async () => Readable.from([contents]) },
    { mode: () => "enforce" },
    {
      assess: async (input) => ({
        outcome: "ALLOW",
        reasonCodes: [],
        sourceVersion: input.version,
        digest: input.digest,
      }),
    },
  );
  await service.process(row.id, 1, true, signal.signal, 1, Date.now());
  assert.deepEqual(committed, ["FAILED"]);
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
