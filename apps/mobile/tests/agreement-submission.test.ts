import assert from "node:assert/strict";
import test from "node:test";
import { agreementSubmission } from "../src/features/learning-paths/api/agreement-submission";

test("send and agree confirms exactly the identity/version returned by the save", async () => {
  const calls: unknown[] = [];
  const submission = agreementSubmission(
    async () => ({ id: "path", version: 4 }),
    async (id, version) => {
      calls.push({ id, version });
    },
    () => true,
  );
  assert.equal(submission.saved, undefined);
  assert.deepEqual(await submission.send(), { id: "path", version: 4 });
  assert.deepEqual(calls, [{ id: "path", version: 4 }]);
});

test("retry after a known save and an unknown confirmation does not create/revise again", async () => {
  let saves = 0,
    confirmations = 0;
  const submission = agreementSubmission(
    async () => {
      saves++;
      return { id: "path", version: 4 };
    },
    async () => {
      if (++confirmations === 1) throw new Error("unknown confirmation");
    },
    () => true,
  );
  await assert.rejects(submission.send(), /unknown confirmation/);
  assert.deepEqual(submission.saved, { id: "path", version: 4 });
  await submission.send();
  assert.equal(saves, 1);
  assert.equal(confirmations, 2);
});

test("failed saves never confirm, and an expired session cannot approve the saved agreement", async () => {
  let confirms = 0,
    current = true;
  const failed = agreementSubmission(
    async (): Promise<{ id: string; version: number }> => {
      throw new Error("save failed");
    },
    async () => {
      confirms++;
    },
    () => true,
  );
  await assert.rejects(failed.send(), /save failed/);
  assert.equal(failed.saved, undefined);
  const expired = agreementSubmission(
    async () => {
      current = false;
      return { id: "path", version: 4 };
    },
    async () => {
      confirms++;
    },
    () => current,
  );
  await assert.rejects(expired.send(), /session/);
  assert.equal(confirms, 0);
});
