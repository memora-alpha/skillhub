import assert from "node:assert/strict";
import test from "node:test";
import { AppError } from "../src/lib/http/errors";
import {
  evidenceDraft,
  readyFileIds,
} from "../src/features/skills/utils/evidence-draft";
import {
  markEvidenceChecking,
  reconcileEvidencePolling,
} from "../src/features/skills/utils/evidence-polling";

function file(id: string) {
  return {
    ...evidenceDraft(
      { uri: "file:///proof.pdf", name: "proof.pdf", size: 1 },
      id,
    ),
    fileId: id,
    state: "READY",
  };
}
test("returning to evidence rechecks uploaded READY files before they can be submitted", () => {
  const original = file("uploaded");
  const selected = evidenceDraft(
    { uri: "file:///new.pdf", name: "new.pdf", size: 1 },
    "selected",
  );
  const checking = markEvidenceChecking([original, selected]);
  assert.equal(readyFileIds([checking[0]!]), null);
  assert.equal(checking[1], selected);
  assert.equal(original.checking, undefined);
  const result = reconcileEvidencePolling(
    checking,
    [original],
    [{ status: "fulfilled", value: { state: "READY" } }],
    new Map(),
  );
  assert.deepEqual(readyFileIds([result[0]!]), ["uploaded"]);
});
test("mixed polling errors preserve uploaded IDs and checking guards while allowing other files to finish", () => {
  const waiting = markEvidenceChecking([file("first"), file("second")]);
  const removed = file("removed");
  const result = reconcileEvidencePolling(
    [waiting[1]!, removed, waiting[0]!],
    waiting,
    [
      { status: "rejected", reason: new AppError("network") },
      { status: "fulfilled", value: { state: "READY" } },
    ],
    new Map(),
  );
  assert.equal(result[0]?.fileId, "second");
  assert.deepEqual(readyFileIds([result[0]!]), ["second"]);
  assert.equal(result[1], removed);
  assert.equal(result[2]?.fileId, "first");
  assert.ok(result[2]?.error);
  assert.equal(readyFileIds([result[2]!]), null);
});
test("bounded polling reports scan timeout, then explicit recheck clears the retry blocker", () => {
  const original = file("uploaded");
  const [timedOut] = reconcileEvidencePolling(
    [original],
    [original],
    [{ status: "fulfilled", value: { state: "SCANNING" } }],
    new Map([["uploaded", 10]]),
  );
  assert.equal(timedOut?.state, "SCANNING");
  assert.ok(timedOut?.error);
  assert.equal(timedOut?.fileId, original.fileId);
  const [retry] = markEvidenceChecking([timedOut!]);
  assert.equal(retry?.error, undefined);
  assert.equal(retry?.checking, true);
  const [ready] = reconcileEvidencePolling(
    [retry!],
    [retry!],
    [{ status: "fulfilled", value: { state: "READY" } }],
    new Map([["uploaded", 10]]),
  );
  assert.equal(ready?.error, undefined);
  assert.deepEqual(readyFileIds([ready!]), ["uploaded"]);
});
