import assert from "node:assert/strict";
import { test } from "node:test";
import { FileStorageService } from "../dist/infrastructure/storage/file-storage.service.js";

const now = new Date("2026-10-05T00:00:00.000Z");
const actor = { userId: "00000000-0000-4000-8000-000000000001" };
const input = {
  actor,
  fileId: "file",
  resource: { type: "conversation", id: "c1" },
};

function setup({ name = "report.pdf", ttl = 60, objectSize = 9 } = {}) {
  const calls = { find: 0, signed: [] };
  const row = {
    id: "file",
    objectKey: "private/file",
    originalName: name,
    detectedMime: "application/pdf",
    sizeBytes: 9,
    state: "READY",
  };
  const service = new FileStorageService(
    { find: async () => (calls.find++, row) },
    {
      head: async () => ({ size: objectSize }),
      signGet: async (key, options) => (
        calls.signed.push({ key, ...options }),
        "https://signed.example.test/"
      ),
    },
    {
      getSnapshot: async () => ({
        values: { "storage.downloadTtlSeconds": ttl },
      }),
    },
    undefined,
    () => now,
  );
  return { service, calls };
}

test("signed GET uses the TTL snapshot, detected MIME and a header-safe attachment name", async () => {
  const { service, calls } = setup({ name: 'báo "cáo"; x=1.pdf', ttl: 60 });
  const result = await service.issueDownload(input, {
    assertRead: async () => {},
  });
  assert.equal(result.expiresAt.toISOString(), "2026-10-05T00:01:00.000Z");
  const [signed] = calls.signed;
  assert.equal(signed.key, "private/file");
  assert.equal(signed.expiresInSeconds, 60);
  assert.equal(signed.mime, "application/pdf");
  assert.match(
    signed.disposition,
    /^attachment; filename="[A-Za-z0-9._-]+"; filename\*=UTF-8''[A-Za-z0-9%._~!'()*-]+$/,
  );
});

test("denied policy reads no file metadata, and a mismatched object is never signed", async () => {
  const denied = setup();
  await assert.rejects(
    denied.service.issueDownload(input, {
      assertRead: async () => {
        throw new Error("denied");
      },
    }),
    /FILE_NOT_FOUND/,
  );
  assert.equal(denied.calls.find, 0);
  const replaced = setup({ objectSize: 10 });
  await assert.rejects(
    replaced.service.issueDownload(input, { assertRead: async () => {} }),
    /FILE_OBJECT_MISMATCH/,
  );
  assert.deepEqual(replaced.calls.signed, []);
});
