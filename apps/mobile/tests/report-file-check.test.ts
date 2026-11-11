import assert from "node:assert/strict";
import { test } from "node:test";
import { checkReportFiles } from "../src/features/reports/utils/check-report-files";
import type { UploadedFile } from "../src/lib/http/file-upload";

const file = (n = 1): UploadedFile => ({
  fileId: `b0000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
  name: `proof-${n}.png`,
  state: "QUARANTINED",
});
const signal = () => new AbortController().signal;
test("sending waits through quarantine/scanning and keeps file order before creating a report", async () => {
  const events: string[] = [],
    states = ["QUARANTINED", "SCANNING", "READY"];
  const files = [file()];
  const ready = await checkReportFiles(files, {
    signal: signal(),
    active: () => true,
    read: async (id) => {
      const state = states.shift()!;
      events.push(state);
      return { fileId: id, state };
    },
    update: (value) => events.push(`ui:${value.state}`),
    sleep: async () => {},
  });
  events.push("POST");
  assert.deepEqual(events, [
    "QUARANTINED",
    "ui:QUARANTINED",
    "SCANNING",
    "ui:SCANNING",
    "READY",
    "ui:READY",
    "POST",
  ]);
  assert.equal(ready[0]?.fileId, files[0]?.fileId);
  assert.equal(ready[0]?.state, "READY");
  assert.equal(files[0]?.state, "QUARANTINED");
});
test("rejected/failed/unknown states and wrong receipts never authorize a POST, even from a cached READY file", async () => {
  for (const state of ["REJECTED", "SCAN_FAILED", "DELETED", "UNKNOWN"]) {
    let posts = 0;
    await assert.rejects(async () => {
      await checkReportFiles([{ ...file(), state: "READY" }], {
        signal: signal(),
        active: () => true,
        read: async (id) => ({ fileId: id, state }),
        update: () => {},
      });
      posts++;
    }, /Bỏ tệp này/);
    assert.equal(posts, 0);
  }
  await assert.rejects(
    checkReportFiles([file()], {
      signal: signal(),
      active: () => true,
      read: async () => ({ fileId: file(2).fileId, state: "READY" }),
      update: () => {},
    }),
    /Chưa xác nhận được tệp/,
  );
});
test("checks are bounded and use at most two concurrent readers", async () => {
  let active = 0,
    peak = 0;
  const files = Array.from({ length: 5 }, (_, i) => file(i + 1));
  const ready = await checkReportFiles(files, {
    signal: signal(),
    active: () => true,
    update: () => {},
    read: async (id) => {
      active++;
      peak = Math.max(peak, active);
      await new Promise(setImmediate);
      active--;
      return { fileId: id, state: "READY" };
    },
  });
  assert.equal(peak, 2);
  assert.deepEqual(
    ready.map((item) => item.fileId),
    files.map((item) => item.fileId),
  );
  let reads = 0;
  await assert.rejects(
    checkReportFiles([file()], {
      signal: signal(),
      active: () => true,
      update: () => {},
      sleep: async () => {},
      read: async (id) => {
        reads++;
        return { fileId: id, state: "SCANNING" };
      },
    }),
    /không cần chọn lại tệp/,
  );
  assert.equal(reads, 48);
});
test("owner changes and aborts stop the flow before applying late results or submitting", async () => {
  let current = true,
    updates = 0;
  await assert.rejects(
    checkReportFiles([file()], {
      signal: signal(),
      active: () => current,
      read: async (id) => {
        current = false;
        return { fileId: id, state: "READY" };
      },
      update: () => {
        updates++;
      },
    }),
    /Đã dừng kiểm tra/,
  );
  assert.equal(updates, 0);
  const controller = new AbortController();
  let reads = 0;
  await assert.rejects(
    checkReportFiles([file()], {
      signal: controller.signal,
      active: () => true,
      update: () => {},
      read: async (id) => {
        reads++;
        return { fileId: id, state: "SCANNING" };
      },
      sleep: async () => {
        controller.abort();
      },
    }),
    /Đã dừng kiểm tra/,
  );
  assert.equal(reads, 1);
});
test("network failures propagate and reports without files require no status reads", async () => {
  const failure = new Error("read failed");
  await assert.rejects(
    checkReportFiles([file()], {
      signal: signal(),
      active: () => true,
      update: () => {},
      read: async () => {
        throw failure;
      },
    }),
    (error) => error === failure,
  );
  assert.deepEqual(
    await checkReportFiles([], {
      signal: signal(),
      active: () => true,
      update: () => {},
      read: async () => {
        throw failure;
      },
    }),
    [],
  );
});
