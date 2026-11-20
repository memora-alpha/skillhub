import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { Readable } from "node:stream";
import { FileContentModeration } from "../../dist/infrastructure/storage/file-content-moderation.js";
import { MediaModerationService } from "../../dist/modules/content-moderation/application/media-moderation.service.js";
import { Prisma } from "../../dist/generated/prisma/client.js";

test("media cannot approve an image until visual and extracted text checks both pass", async () => {
  const seen = [];
  const service = new MediaModerationService(
    {
      mode: () => "enforce",
      evaluate: async (input) => {
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
      evaluate: async () => ({ outcome: "ALLOW" }),
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

test("observe records extraction failures without making them enforcement decisions", async () => {
  const service = new MediaModerationService(
    { mode: () => "observe", evaluate: async () => ({ outcome: "ALLOW" }) },
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
  assert.equal(result.observedOutcome, "REVIEW");
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
