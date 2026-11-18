import assert from "node:assert/strict";
import { test } from "node:test";
import { AppError } from "../src/lib/http/errors";
import {
  createOwnerMaterialActions,
  type OwnerActionState,
} from "../src/features/materials/utils/owner-material-actions";
import { fixtureMaterial } from "./fixtures/materials-data";

test("uncertain draft deletion locks writes and explicitly retries the same ID and version without guessing from a missing list row", async () => {
  const writes: unknown[] = [],
    removed: string[] = [];
  let state: OwnerActionState = {};
  const row = fixtureMaterial({ listingVersion: 7 });
  const actions = createOwnerMaterialActions({
    api: {
      submit: async () => {
        throw Error("unexpected submit");
      },
      archive: async () => {
        throw Error("unexpected archive");
      },
      withdraw: async () => {
        throw Error("unexpected withdraw");
      },
      ownerDetail: async () => {
        throw Error("missing owner row is not proof of deletion");
      },
      remove: async (id, version) => {
        writes.push([id, version]);
        if (writes.length === 1) throw new AppError("network");
        return { id, deleted: true, replayed: true };
      },
    },
    isCurrent: () => true,
    onChange: (value) => {
      state = value;
    },
    onResult: async () => {
      throw Error("delete receipt is not a material projection");
    },
    onDeleted: async (id) => {
      removed.push(id);
    },
    onFailure() {},
  });
  await actions.run("archive", row);
  await actions.run("archive", { ...row, status: "REJECTED" });
  await actions.run("archive", { ...row, status: "PENDING_REVIEW" });
  assert.deepEqual(
    state,
    {},
    "unsupported archive states cannot dispatch or lock the controller",
  );
  for (const status of [
    "PENDING_REVIEW",
    "PUBLISHED",
    "HIDDEN",
    "REJECTED",
  ] as const)
    await actions.run("delete", { ...row, status });
  assert.deepEqual(writes, []);
  await actions.run("delete", row);
  assert.equal(state.uncertain?.action, "delete");
  await actions.run("delete", { ...row, listingVersion: 8 });
  await actions.run("archive", row);
  actions.resetFeedback();
  assert.equal(writes.length, 1);
  assert.deepEqual(removed, []);
  await actions.reconcile();
  assert.deepEqual(writes, [
    [row.id, 7],
    [row.id, 7],
  ]);
  assert.deepEqual(removed, [row.id]);
  assert.equal(state.uncertain, undefined);
  assert.deepEqual(state, {}, "delete success clears pending feedback");
});

test("a rejected stale delete clears uncertainty for a fresh read and old-session receipts cannot update cache", async () => {
  let active = true,
    count = 0,
    deleted = 0;
  let state: OwnerActionState = {};
  const row = fixtureMaterial();
  const actions = createOwnerMaterialActions({
    api: {
      submit: async () => row,
      archive: async () => row,
      withdraw: async () => row,
      ownerDetail: async () => row,
      remove: async (id) => {
        count++;
        if (count === 1) throw new AppError("network");
        if (count === 2)
          throw new AppError("http", 409, "MATERIAL_VERSION_CONFLICT");
        active = false;
        return { id, deleted: true, replayed: false };
      },
    },
    isCurrent: () => active,
    onChange: (value) => {
      state = value;
    },
    onResult: async () => {},
    onDeleted: async () => {
      deleted++;
    },
    onFailure() {},
  });
  await actions.run("delete", row);
  await actions.reconcile();
  assert.equal(state.uncertain, undefined);
  assert.ok(state.error instanceof AppError);
  await actions.run("delete", { ...row, listingVersion: 2 });
  assert.equal(deleted, 0);
});
