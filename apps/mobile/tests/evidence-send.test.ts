import assert from "node:assert/strict";
import test from "node:test";
import { prepareEvidence } from "../src/features/skills/utils/prepare-evidence";
import {
  evidenceDraft,
  type EvidenceDraft,
} from "../src/features/skills/utils/evidence-draft";

function fixture(count = 1) {
  let files = Array.from({ length: count }, (_, index) =>
    evidenceDraft(
      {
        uri: `blob:file-${index}`,
        name: `proof-${index}.pdf`,
        file: new File(["proof"], `proof-${index}.pdf`, {
          type: "application/pdf",
        }),
      },
      `local-${index}`,
    ),
  );
  const abort = new AbortController();
  const calls: string[] = [];
  const delays: number[] = [];
  let scans = 0,
    uploads = 0;
  const api = {
    async upload(_id: string, body: FormData) {
      assert.equal((body.get("file") as File).type, "application/pdf");
      calls.push("upload");
      return { fileId: `file-${++uploads}`, state: "QUARANTINED" };
    },
    async fileStatus(_id: string, fileId: string) {
      calls.push(`read:${fileId}`);
      return { fileId, state: ++scans === 1 ? "SCANNING" : "READY" };
    },
  };
  const run = (assertCurrent = () => {}) =>
    prepareEvidence({
      api,
      id: "skill",
      files,
      signal: abort.signal,
      assertCurrent,
      update: (file) => {
        files = files.map((item) =>
          item.localId === file.localId ? file : item,
        );
      },
      sleep: async (ms) => {
        delays.push(ms);
      },
    });
  return {
    api,
    abort,
    calls,
    delays,
    run,
    files: () => files,
    replace: (next: EvidenceDraft[]) => {
      files = next;
    },
  };
}
test("a send uploads selected files, waits for scan and returns only ready IDs", async () => {
  const h = fixture(2);
  assert.deepEqual(await h.run(), ["file-1", "file-2"]);
  assert.deepEqual(h.calls, [
    "upload",
    "read:file-1",
    "read:file-1",
    "upload",
    "read:file-2",
  ]);
  assert.deepEqual(h.delays, [1000]);
  assert.ok(h.files().every((file) => file.state === "READY"));
});
test("existing ready files are checked again without reupload", async () => {
  const h = fixture();
  await h.run();
  h.calls.length = 0;
  assert.deepEqual(await h.run(), ["file-1"]);
  assert.deepEqual(h.calls, ["read:file-1"]);
});
test("partial upload failure preserves completed IDs for an explicit retry", async () => {
  const h = fixture(2);
  const upload = h.api.upload;
  let uploads = 0;
  h.api.upload = async (id, body) => {
    if (++uploads === 2) throw new Error("storage unavailable");
    return upload(id, body);
  };
  await assert.rejects(h.run(), /storage unavailable/);
  assert.equal(h.files()[0]?.fileId, "file-1");
  assert.equal(h.files()[1]?.state, "UPLOAD_FAILED");
  h.api.upload = upload;
  h.calls.length = 0;
  assert.deepEqual(await h.run(), ["file-1", "file-2"]);
  assert.equal(h.calls.filter((call) => call === "upload").length, 1);
});
test("rejected or unknown storage states cannot produce a submit payload", async () => {
  for (const state of [
    "REJECTED",
    "SCAN_FAILED",
    "DELETED",
    "CLEANUP_PENDING",
    "UNKNOWN",
  ]) {
    const h = fixture();
    h.api.fileStatus = async (_id, fileId) => ({ fileId, state });
    await assert.rejects(h.run(), /chưa thể sử dụng/);
    assert.equal(h.files()[0]?.state, state);
    assert.ok(h.files()[0]?.error);
  }
});
test("scan polling is bounded and keeps uploaded files for retry", async () => {
  const h = fixture();
  h.api.fileStatus = async (_id, fileId) => {
    h.calls.push("scan");
    return { fileId, state: "SCANNING" };
  };
  await assert.rejects(h.run(), /lâu hơn dự kiến/);
  assert.equal(h.calls.filter((call) => call === "scan").length, 10);
  assert.equal(h.delays.length, 9);
  assert.ok(h.delays.every((ms) => ms <= 8000));
  assert.equal(h.files()[0]?.fileId, "file-1");
});
test("cancellation after upload preserves its ID and prevents status reads", async () => {
  const h = fixture();
  const upload = h.api.upload;
  h.api.upload = async (id, body) => {
    const result = await upload(id, body);
    h.abort.abort();
    return result;
  };
  await assert.rejects(h.run(), /tạm dừng/);
  assert.deepEqual(h.calls, ["upload"]);
  assert.equal(h.files()[0]?.fileId, "file-1");
});
test("a changed session stops subsequent preparation requests", async () => {
  const h = fixture();
  let current = true;
  const upload = h.api.upload;
  h.api.upload = async (id, body) => {
    const result = await upload(id, body);
    current = false;
    return result;
  };
  await assert.rejects(
    h.run(() => {
      if (!current) throw new Error("changed session");
    }),
    /changed session/,
  );
  assert.deepEqual(h.calls, ["upload"]);
});
test("empty, oversized batches and duplicate file IDs cannot prepare", async () => {
  for (const count of [0, 6]) {
    const h = fixture(count);
    await assert.rejects(h.run(), /1 đến 5/);
    assert.deepEqual(h.calls, []);
  }
  const h = fixture(2);
  h.replace(
    h.files().map((file) => ({ ...file, fileId: "same", state: "READY" })),
  );
  h.api.fileStatus = async (_id, fileId) => ({ fileId, state: "READY" });
  await assert.rejects(h.run(), /chưa sẵn sàng/);
});
