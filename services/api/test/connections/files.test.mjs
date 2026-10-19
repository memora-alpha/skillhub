import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { FileAttachmentService } from "../../dist/infrastructure/storage/file-attachment.service.js";
const owner = randomUUID(),
  messageId = randomUUID();
function fixture(patch = {}) {
  const row = {
    id: randomUUID(),
    uploadedBy: owner,
    purpose: "CHAT",
    state: "READY",
    scanVerdict: "CLEAN",
    sha256: "a".repeat(64),
    detectedMime: "application/pdf",
    sizeBytes: 15_000_000,
    generation: 1,
    originalName: "report.pdf",
    objectKey: "private/test",
    attachedAt: null,
    resourceType: null,
    resourceId: null,
    ...patch,
  };
  const tx = {
    $queryRaw: async () => [],
    storedFile: {
      findUnique: async () => row,
      update: async ({ data }) => Object.assign(row, data),
    },
  };
  return { row, tx, service: new FileAttachmentService(tx) };
}
test("binding accepts only own READY/CLEAN CHAT and the same immutable message binding", async () => {
  const f = fixture();
  await f.service.chatManifest(f.tx, owner, [f.row.id], messageId, true);
  assert.equal(f.row.resourceId, messageId);
  assert.equal(
    (await f.service.chatManifest(f.tx, owner, [f.row.id], messageId, true))
      .length,
    1,
  );
  await assert.rejects(
    f.service.chatManifest(f.tx, owner, [f.row.id], randomUUID(), true),
    /FILE_ALREADY_BOUND/,
  );
  for (const patch of [
    { uploadedBy: randomUUID() },
    { purpose: "EVIDENCE" },
    { state: "SCANNING" },
    { scanVerdict: "INFECTED" },
    { sizeBytes: 15_000_001 },
  ]) {
    const invalid = fixture(patch);
    await assert.rejects(
      invalid.service.chatManifest(
        invalid.tx,
        owner,
        [invalid.row.id],
        messageId,
        true,
      ),
    );
  }
});
test("aggregate and count limits reject unsafe manifests before transaction commit", async () => {
  const f = fixture();
  await assert.rejects(
    f.service.chatManifest(
      f.tx,
      owner,
      Array.from({ length: 4 }, randomUUID),
      messageId,
    ),
    /FILE_TOO_LARGE/,
  );
  const small = fixture({ sizeBytes: 1 });
  await assert.rejects(
    small.service.chatManifest(
      small.tx,
      owner,
      Array.from({ length: 6 }, randomUUID),
      messageId,
    ),
    /FILE_TOO_LARGE/,
  );
});
