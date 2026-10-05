import assert from "node:assert/strict";
import { Readable } from "node:stream";
import test from "node:test";
import { FileStorageService } from "../dist/infrastructure/storage/file-storage.service.js";

const payload = Buffer.from("%PDF-1.7\n%%EOF\n");
const actor = { userId: "00000000-0000-4000-8000-000000000001" };

function setup() {
  const rows = new Map();
  const objects = new Map();
  const calls = { finalized: 0, signed: 0, removed: 0 };
  const repo = {
    async createUploading(row) {
      rows.set(row.id, { ...row, state: "UPLOADING" });
    },
    async finalize(input) {
      const row = rows.get(input.id);
      if (row.state !== "UPLOADING") throw Error("state");
      Object.assign(row, input, { state: "QUARANTINED" });
      calls.finalized++;
    },
    async failUpload(id) {
      rows.get(id).state = "UPLOAD_FAILED";
    },
    async find(id) {
      return rows.get(id) ?? null;
    },
  };
  const storage = {
    async put(key, body) {
      const chunks = [];
      for await (const chunk of body) chunks.push(chunk);
      objects.set(key, Buffer.concat(chunks));
    },
    async read(key) {
      return Readable.from([objects.get(key)]);
    },
    async head(key) {
      return objects.has(key) ? { size: objects.get(key).length } : null;
    },
    async remove(key) {
      calls.removed++;
      objects.delete(key);
    },
    async signGet() {
      calls.signed++;
      return "https://private.example/signed";
    },
  };
  const configuration = {
    async getSnapshot() {
      return {
        values: {
          "storage.evidenceMaxBytes": 10_000_000,
          "storage.downloadTtlSeconds": 120,
        },
      };
    },
  };
  const service = new FileStorageService(repo, storage, configuration);
  return { service, rows, objects, calls };
}

test("upload stores with a generated key and only finalizes after re-reading format", async () => {
  const { service, rows, objects, calls } = setup();
  const result = await service.upload({
    actor,
    purpose: "EVIDENCE",
    name: "report.pdf",
    claimedMime: "application/pdf",
    body: Readable.from([payload]),
    context: { correlationId: "test" },
  });
  assert.deepEqual(result, { fileId: result.fileId, state: "QUARANTINED" });
  const row = rows.get(result.fileId);
  assert.equal(row.state, "QUARANTINED");
  assert.equal(row.objectKey.includes("report.pdf"), false);
  assert.equal(objects.size, 1);
  assert.equal(calls.finalized, 1);
});

test("bad format and oversized streamed body stay private and never finalize", async () => {
  const { service, rows, calls } = setup();
  for (const body of [Buffer.from("MZ executable"), Buffer.alloc(10_000_001)]) {
    await assert.rejects(
      service.upload({
        actor,
        purpose: "EVIDENCE",
        name: "report.pdf",
        claimedMime: "application/pdf",
        body: Readable.from([body]),
        context: { correlationId: "test" },
      }),
    );
  }
  assert.equal(calls.finalized, 0);
  assert.equal(
    [...rows.values()].every((row) => row.state === "UPLOAD_FAILED"),
    true,
  );
});

test("download checks policy before file state and signs only READY", async () => {
  const { service, rows, calls } = setup();
  const result = await service.upload({
    actor,
    purpose: "EVIDENCE",
    name: "report.pdf",
    claimedMime: "application/pdf",
    body: Readable.from([payload]),
    context: { correlationId: "test" },
  });
  const input = {
    actor,
    fileId: result.fileId,
    resource: { type: "verification", id: "owner" },
  };
  await assert.rejects(
    service.issueDownload(input, {
      async assertRead() {
        throw Error("denied");
      },
    }),
    /FILE_NOT_FOUND/,
  );
  assert.equal(calls.signed, 0);
  const permit = { async assertRead() {} };
  await assert.rejects(service.issueDownload(input, permit), /FILE_NOT_READY/);
  rows.get(result.fileId).state = "READY";
  const signed = await service.issueDownload(input, permit);
  assert.match(signed.url, /signed/);
  assert.equal(calls.signed, 1);
  assert.equal(signed.expiresAt.getTime() > Date.now(), true);
});
