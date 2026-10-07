import assert from "node:assert/strict";
import test from "node:test";
import { validateFile } from "../dist/infrastructure/storage/file-policy.js";

const pdf = {
  purpose: "EVIDENCE",
  name: "evidence.pdf",
  claimedMime: "application/pdf",
  detectedMime: "application/pdf",
  sizeBytes: 10_000_000,
  capBytes: 10_000_000,
};

test("evidence accepts its approved 10 MB boundary and rejects one more byte", () => {
  assert.equal(validateFile(pdf).sizeBytes, 10_000_000);
  assert.throws(
    () => validateFile({ ...pdf, sizeBytes: 10_000_001 }),
    /FILE_TOO_LARGE/,
  );
  assert.throws(
    () => validateFile({ ...pdf, capBytes: undefined }),
    /FILE_POLICY_UNAVAILABLE/,
  );
});

test("chat uses 15 MB boundary and its additional file types", () => {
  const chat = {
    ...pdf,
    purpose: "CHAT",
    name: "table.xlsx",
    claimedMime:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    detectedMime:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    sizeBytes: 15_000_000,
    capBytes: undefined,
  };
  assert.equal(validateFile(chat).sizeBytes, 15_000_000);
  assert.throws(
    () => validateFile({ ...chat, sizeBytes: 15_000_001 }),
    /FILE_TOO_LARGE/,
  );
  assert.throws(
    () => validateFile({ ...chat, purpose: "REPORT" }),
    /FILE_POLICY_UNAVAILABLE/,
  );
});

test("filename, extension, MIME, and empty file checks fail closed", () => {
  for (const value of [
    { name: "../evidence.pdf" },
    { name: "evidence.exe.pdf" },
    { name: "evidence.PDF\u0000" },
    { name: "evidence.svg" },
    { claimedMime: "application/octet-stream" },
    { detectedMime: "application/zip" },
    { sizeBytes: 0 },
  ]) {
    assert.throws(() => validateFile({ ...pdf, ...value }));
  }
});
