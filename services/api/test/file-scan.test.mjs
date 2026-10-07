import assert from "node:assert/strict";
import { Readable } from "node:stream";
import test from "node:test";
import { FileScanProcessor } from "../dist/infrastructure/storage/file-scan.processor.js";

function setup(verdict, scannerHash = true) {
  let state = "QUARANTINED";
  let attempts = 0;
  const claim = {
    id: "file",
    generation: 1,
    objectKey: "private/file",
    sizeBytes: 4,
    sha256: "hash",
    attempt: 0,
    leaseToken: "token",
  };
  const repository = {
    async claim() {
      if (state !== "QUARANTINED" || attempts >= 3) return null;
      state = "SCANNING";
      attempts++;
      return { ...claim, attempt: attempts, leaseToken: `token-${attempts}` };
    },
    async complete(input) {
      if (
        state !== "SCANNING" ||
        input.claim.leaseToken !== `token-${attempts}`
      )
        return false;
      state =
        input.verdict === "CLEAN"
          ? "READY"
          : input.verdict === "INFECTED"
            ? "REJECTED"
            : attempts >= 3
              ? "SCAN_FAILED"
              : "QUARANTINED";
      return true;
    },
    async currentState() {
      return state;
    },
  };
  const objects = {
    async head() {
      return { size: scannerHash ? 4 : 5 };
    },
    async read() {
      return Readable.from([Buffer.from("test")]);
    },
  };
  const scanner = {
    async scan() {
      return { verdict, scannerVersion: "test" };
    },
  };
  return {
    processor: new FileScanProcessor(repository, objects, scanner),
    getState: () => state,
  };
}

test("only a clean verdict for the claimed object reaches READY", async () => {
  const good = setup("CLEAN");
  assert.equal(await good.processor.process("file", 1), "READY");
  assert.equal(good.getState(), "READY");
  assert.equal(await good.processor.process("file", 1), "READY");
  const mismatch = setup("CLEAN", false);
  await assert.rejects(
    mismatch.processor.process("file", 1),
    /FILE_SCAN_RETRY/,
  );
  assert.equal(mismatch.getState(), "QUARANTINED");
});

test("infected is rejected, UNKNOWN retries and ultimately fails closed", async () => {
  const infected = setup("INFECTED");
  assert.equal(await infected.processor.process("file", 1), "REJECTED");
  const unknown = setup("UNKNOWN");
  await assert.rejects(unknown.processor.process("file", 1), /FILE_SCAN_RETRY/);
  await assert.rejects(unknown.processor.process("file", 1), /FILE_SCAN_RETRY/);
  assert.equal(await unknown.processor.process("file", 1), "SCAN_FAILED");
  assert.equal(unknown.getState(), "SCAN_FAILED");
});
