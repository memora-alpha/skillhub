import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID, createHash } from "node:crypto";
import { Readable } from "node:stream";
import { verificationAiConfiguration } from "../../dist/modules/verifications/domain/verification-ai.config.js";
import {
  parseAiFileResult,
  aggregateAiResults,
} from "../../dist/modules/verifications/domain/verification-ai.types.js";
import { FileStorageService } from "../../dist/infrastructure/storage/file-storage.service.js";
import { aiSnapshot, aiFileResult } from "./fixtures.mjs";

test("disabled integration requires no credential; invalid enabled settings only expose field names", () => {
  assert.equal(verificationAiConfiguration({}).enabled, false);
  assert.throws(
    () => verificationAiConfiguration({ VERIFICATION_AI_ENABLED: "yes" }),
    /VERIFICATION_AI_ENABLED/,
  );
  const secret = "private-key-placeholder";
  assert.throws(
    () =>
      verificationAiConfiguration({
        VERIFICATION_AI_ENABLED: "true",
        GEMINI_API_KEY: secret,
        GEMINI_MODEL: "https://untrusted.example",
      }),
    (error) => {
      assert.match(error.message, /GEMINI_MODEL/);
      assert.ok(!error.message.includes(secret));
      return true;
    },
  );
  assert.equal(
    verificationAiConfiguration({
      VERIFICATION_AI_ENABLED: "true",
      GEMINI_API_KEY: secret,
    }).maxInputTokens,
    16000,
  );
});

test("reject unsupported authenticity claims, missing date evidence, wrong evidence IDs/pages and ungrounded approval", () => {
  const file = aiSnapshot().files[0];
  const valid = aiFileResult(file);
  assert.equal(parseAiFileResult(valid, file).issuerVerification, "UNVERIFIED");
  for (const patch of [
    { issuerVerification: "VERIFIED_AT_SOURCE" },
    { levelAssessment: "SUPPORTED" },
    { evidenceId: randomUUID() },
    { nameMatch: "UNKNOWN" },
    { findings: [] },
    {
      dateSources: {
        examinationDate: null,
        issuedAt: null,
        expiresAt: { page: 1, quote: "after two years" },
      },
    },
    { extractedFields: { ...valid.extractedFields, expiresAt: "2022-12-03" } },
    {
      findings: [
        { ...valid.findings[0], sources: [{ page: 2, quote: "218" }] },
      ],
    },
  ])
    assert.throws(
      () => parseAiFileResult({ ...valid, ...patch }, file),
      /AI_INVALID_OUTPUT|AI_UNGROUNDED_OUTPUT/,
    );
  const suspect = {
    ...valid,
    tamperingAssessment: "SUSPICIOUS",
    recommendation: "NEEDS_REVIEW",
    findings: [],
  };
  assert.throws(() => parseAiFileResult(suspect, file), /AI_UNGROUNDED_OUTPUT/);
});

test("a good file cannot override a problematic file in a batch", () => {
  const file = aiSnapshot().files[0];
  const good = aiFileResult(file);
  const bad = aiFileResult(file, {
    recommendation: "INSUFFICIENT_EVIDENCE",
    skillRelevance: "NOT_RELEVANT",
  });
  assert.equal(
    aggregateAiResults([good, good]).batchRecommendation,
    "SUPPORTS_SKILL",
  );
  assert.equal(
    aggregateAiResults([good, bad]).batchRecommendation,
    "NEEDS_REVIEW",
  );
  assert.equal(
    aggregateAiResults([bad]).batchRecommendation,
    "INSUFFICIENT_EVIDENCE",
  );
});

test("private analysis reads require policy and verify stored bytes/checksum without signing URLs", async () => {
  const body = Buffer.from("fixture");
  const row = {
    purpose: "EVIDENCE",
    state: "READY",
    sizeBytes: body.length,
    sha256: createHash("sha256").update(body).digest("hex"),
    objectKey: "private/test",
  };
  let reads = 0;
  const service = new FileStorageService(
    { find: async () => row },
    {
      read: async () => {
        reads++;
        return Readable.from([body]);
      },
    },
    {},
  );
  await assert.rejects(
    service.readEvidenceForAnalysis("file", async () => {
      throw new Error("denied");
    }),
    /denied/,
  );
  assert.equal(reads, 0);
  assert.deepEqual(
    await service.readEvidenceForAnalysis("file", async () => {}),
    body,
  );
  row.sha256 = "a".repeat(64);
  await assert.rejects(
    service.readEvidenceForAnalysis("file", async () => {}),
    /FILE_OBJECT_MISMATCH/,
  );
  row.sizeBytes = 1;
  await assert.rejects(
    service.readEvidenceForAnalysis("file", async () => {}),
    /FILE_OBJECT_MISMATCH/,
  );
});
