import assert from "node:assert/strict";
import test from "node:test";
import { FileReconciler } from "../dist/infrastructure/storage/file-reconciler.js";

test("cleanup removes only repository-claimed stale objects and marks them deleted", async () => {
  const events = [];
  const repo = {
    async reconcileExpiredScans() {
      events.push("scans");
      return 1;
    },
    async claimCleanup(before) {
      assert.equal(before < new Date(), true);
      events.push("claim");
      return [{ id: "stale", objectKey: "private/stale" }];
    },
    async markDeleted(id) {
      events.push(`deleted:${id}`);
    },
  };
  const objects = {
    async remove(key) {
      events.push(`remove:${key}`);
    },
  };
  const reconciler = new FileReconciler(repo, objects, { get: () => false });
  assert.deepEqual(await reconciler.runOnce(), {
    cleaned: 1,
    scansRecovered: 1,
  });
  assert.deepEqual(events, [
    "scans",
    "claim",
    "remove:private/stale",
    "deleted:stale",
  ]);
});

test("failed object removal keeps cleanup pending for retry", async () => {
  let deleted = false;
  const reconciler = new FileReconciler(
    {
      async reconcileExpiredScans() {
        return 0;
      },
      async claimCleanup() {
        return [{ id: "stale", objectKey: "private/stale" }];
      },
      async markDeleted() {
        deleted = true;
      },
    },
    {
      async remove() {
        throw Error("provider unavailable");
      },
    },
    { get: () => false },
  );
  assert.deepEqual(await reconciler.runOnce(), {
    cleaned: 0,
    scansRecovered: 0,
  });
  assert.equal(deleted, false);
});
