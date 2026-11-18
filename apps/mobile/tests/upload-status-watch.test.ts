import assert from "node:assert/strict";
import { test } from "node:test";
import { AppError } from "../src/lib/http/errors";
import type { UploadedFile } from "../src/lib/http/file-upload";
import {
  watchUploadStatus,
  UploadScanPending,
  UPLOAD_SCAN_TIMEOUT_MS,
  waitForUploadCheck,
} from "../src/lib/http/watch-upload-status";

function context(states = ["SCANNING", "READY"]) {
  let files: UploadedFile[] = [
    { fileId: "upload-1", name: "lesson.docx", state: "QUARANTINED" },
  ];
  let time = 0,
    reads = 0;
  const changes: UploadedFile[][] = [];
  const request = new AbortController();
  const options = {
    files: () => files,
    read: async (id: string) => {
      reads++;
      return {
        fileId: id,
        state: states[Math.min(reads - 1, states.length - 1)]!,
      };
    },
    update: (next: UploadedFile[]) => {
      changes.push(next);
      files = next;
    },
    active: () => true,
    signal: request.signal,
    now: () => time,
    sleep: async (ms: number) => {
      assert.ok(ms > 0 && ms <= 5000);
      time += ms;
    },
  };
  return {
    options,
    request,
    changes,
    files: () => files,
    setFiles: (next: UploadedFile[]) => {
      files = next;
    },
    reads: () => reads,
    time: () => time,
  };
}
test("upload status advances to server READY automatically, preserving the selected file without uploading again", async () => {
  const ctx = context(["QUARANTINED", "SCANNING", "READY"]);
  await watchUploadStatus(ctx.options);
  assert.equal(ctx.reads(), 3);
  assert.deepEqual(ctx.files(), [
    { fileId: "upload-1", name: "lesson.docx", state: "READY" },
  ]);
  await watchUploadStatus(ctx.options);
  assert.equal(ctx.reads(), 3, "a terminal READY file is not polled again");
});
test("failed or rejected scans stop checking and never become READY on the client", async () => {
  for (const state of [
    "REJECTED",
    "SCAN_FAILED",
    "UPLOAD_FAILED",
    "CLEANUP_PENDING",
    "DELETED",
  ]) {
    const ctx = context([state]);
    await watchUploadStatus(ctx.options);
    assert.equal(ctx.reads(), 1);
    assert.equal(ctx.files()[0]?.state, state);
  }
});
test("a quick scan is observed within one second instead of waiting for a five-second polling gap", async () => {
  const ctx = context();
  const readyAt = 4500;
  await watchUploadStatus({
    ...ctx.options,
    read: async (id) => ({
      fileId: id,
      state: ctx.time() >= readyAt ? "READY" : "SCANNING",
    }),
  });
  assert.ok(ctx.time() >= readyAt && ctx.time() - readyAt <= 1000);
  assert.equal(ctx.files()[0]?.state, "READY");
});
test("a stuck scan has a bounded check window and keeps the server state", async () => {
  const ctx = context(["SCANNING"]);
  await assert.rejects(watchUploadStatus(ctx.options), UploadScanPending);
  assert.equal(ctx.time(), UPLOAD_SCAN_TIMEOUT_MS);
  assert.ok(
    ctx.reads() <= 70,
    "fast initial checks must still back off during a long scan",
  );
  assert.equal(ctx.files()[0]?.state, "SCANNING");
});
test("invalid status identities or unknown states fail closed before updating the draft", async () => {
  for (const row of [
    { fileId: "other", state: "READY" },
    { fileId: "upload-1", state: "CLEAN" },
  ]) {
    const ctx = context();
    await assert.rejects(
      watchUploadStatus({ ...ctx.options, read: async () => row }),
      (error: unknown) =>
        error instanceof AppError && error.kind === "protocol",
    );
    assert.equal(ctx.changes.length, 0);
  }
});
test("late reads after a session change or abort do not update the selected files", async () => {
  for (const abort of [true, false]) {
    const ctx = context();
    let active = true;
    let resolve!: (value: { fileId: string; state: string }) => void;
    const operation = watchUploadStatus({
      ...ctx.options,
      active: () => active,
      read: async () =>
        new Promise((resolveRead) => {
          resolve = resolveRead;
        }),
    });
    if (abort) ctx.request.abort();
    else active = false;
    resolve({ fileId: "upload-1", state: "READY" });
    await operation;
    assert.equal(ctx.changes.length, 0);
  }
});
test("removing or replacing a file while a check is in flight cannot resurrect the old selection", async () => {
  const ctx = context();
  await watchUploadStatus({
    ...ctx.options,
    read: async (id) => {
      ctx.setFiles([{ fileId: "new-file", name: "new.pdf", state: "READY" }]);
      return { fileId: id, state: "READY" };
    },
  });
  assert.deepEqual(ctx.files(), [
    { fileId: "new-file", name: "new.pdf", state: "READY" },
  ]);
});
test("status read errors retain the upload for an explicit read retry; sleeping checks are abortable", async () => {
  const ctx = context(["READY"]);
  await assert.rejects(
    watchUploadStatus({
      ...ctx.options,
      read: async () => {
        throw new AppError("network");
      },
    }),
    AppError,
  );
  assert.equal(ctx.files()[0]?.state, "QUARANTINED");
  await watchUploadStatus(ctx.options);
  assert.equal(ctx.files()[0]?.state, "READY");
  const request = new AbortController();
  const waiting = waitForUploadCheck(5000, request.signal);
  request.abort();
  await assert.rejects(waiting);
});
