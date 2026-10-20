import assert from "node:assert/strict";
import test from "node:test";
import { prepareEvidence } from "../src/features/skills/utils/prepare-evidence";
import { EvidenceScanPending } from "../src/features/skills/utils/evidence-scan";
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
  const run = (
    assertCurrent = () => {},
    options: Partial<
      Pick<Parameters<typeof prepareEvidence>[0], "prepare" | "onSlowScan">
    > = {},
  ) =>
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
      ...options,
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
    "upload",
    "read:file-1",
    "read:file-2",
    "read:file-1",
  ]);
  assert.deepEqual(h.delays, [500]);
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
  let slow = 0;
  await assert.rejects(
    h.run(undefined, {
      onSlowScan: () => {
        slow++;
      },
    }),
    EvidenceScanPending,
  );
  assert.equal(slow, 1);
  assert.equal(h.calls.filter((call) => call === "scan").length, 48);
  assert.equal(h.delays.length, 47);
  assert.ok(h.delays.every((ms) => ms <= 5000));
  assert.equal(
    h.delays.reduce((total, ms) => total + ms, 0),
    183_500,
  );
  assert.equal(h.files()[0]?.fileId, "file-1");
  assert.equal(h.files()[0]?.error, undefined);
});

test("a scan becoming ready after a 65-second retry still completes in the same send", async () => {
  const h = fixture();
  h.api.fileStatus = async (_id, fileId) => ({
    fileId,
    state: h.delays.reduce((a, b) => a + b, 0) >= 65_000 ? "READY" : "SCANNING",
  });
  let slow = false;
  assert.deepEqual(
    await h.run(undefined, {
      onSlowScan: () => {
        slow = true;
      },
    }),
    ["file-1"],
  );
  assert.equal(slow, true);
  assert.equal(h.calls.filter((call) => call === "upload").length, 1);
});

test("upload concurrency is limited to two and a slow upload does not block its sibling", async () => {
  const h = fixture(5);
  let active = 0,
    maxActive = 0;
  const gates: (() => void)[] = [];
  h.api.upload = async (_id, body) => {
    const name = (body.get("file") as File).name;
    active++;
    maxActive = Math.max(maxActive, active);
    await new Promise<void>((resolve) => gates.push(resolve));
    active--;
    return { fileId: name, state: "QUARANTINED" };
  };
  h.api.fileStatus = async (_id, fileId) => ({ fileId, state: "READY" });
  const pending = h.run();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(gates.length, 2);
  gates[0]!();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(gates.length, 3);
  gates[1]!();
  gates[2]!();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(gates.length, 5);
  gates[3]!();
  gates[4]!();
  assert.equal((await pending).length, 5);
  assert.equal(maxActive, 2);
});

test("compression and upload pipeline without waiting for every image to finish preparing", async () => {
  const h = fixture(2);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const pending = h.run(undefined, {
    prepare: async (file) => {
      if (file.localId === "local-1") await gate;
      return file;
    },
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(h.calls.filter((call) => call === "upload").length, 1);
  release();
  assert.equal((await pending).length, 2);
});

test("upload failure drains in-flight uploads, retains their IDs and stops unstarted files", async () => {
  const h = fixture(3);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let calls = 0,
    settled = false;
  h.api.upload = async () => {
    if (++calls === 1) throw new Error("upload failed");
    await gate;
    return { fileId: "completed-sibling", state: "QUARANTINED" };
  };
  const pending = h.run();
  const rejected = assert.rejects(pending, /upload failed/).then(() => {
    settled = true;
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(settled, false);
  assert.equal(calls, 2);
  release();
  await rejected;
  assert.equal(h.files()[1]?.fileId, "completed-sibling");
  assert.equal(h.files()[2]?.state, "SELECTED");
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

test("one pending scan cannot postpone other uploads or scan reads", async () => {
  const h = fixture(2);
  let release!: () => void;
  const scansReady = new Promise<void>((resolve) => {
    release = resolve;
  });
  h.api.fileStatus = async (_id, fileId) => {
    h.calls.push(`read:${fileId}`);
    await scansReady;
    return { fileId, state: "READY" };
  };
  const pending = h.run();
  await new Promise((resolve) => setImmediate(resolve));
  try {
    assert.equal(h.calls.filter((call) => call === "upload").length, 2);
    assert.equal(h.calls.filter((call) => call.startsWith("read:")).length, 2);
  } finally {
    release();
  }
  assert.deepEqual(await pending, ["file-1", "file-2"]);
});

test("a rejected scan stops sibling waits promptly and preserves every uploaded ID for retry", async () => {
  const h = fixture(2);
  let stopped = false;
  h.api.fileStatus = async (_id, fileId, signal?: AbortSignal) => {
    if (fileId === "file-1") return { fileId, state: "REJECTED" };
    await new Promise<void>((resolve) => {
      signal?.addEventListener(
        "abort",
        () => {
          stopped = true;
          resolve();
        },
        { once: true },
      );
    });
    return { fileId, state: "SCANNING" };
  };
  await assert.rejects(h.run(), /chưa thể sử dụng/);
  assert.equal(stopped, true);
  assert.deepEqual(
    h.files().map((file) => file.fileId),
    ["file-1", "file-2"],
  );
  assert.ok(h.files().every((file) => !file.checking));
});
