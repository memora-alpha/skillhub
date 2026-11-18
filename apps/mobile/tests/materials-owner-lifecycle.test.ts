import assert from "node:assert/strict";
import { test } from "node:test";
import { AppError } from "../src/lib/http/errors";
import { createMaterialsApi } from "../src/features/materials/api/materials-api";
import {
  createOwnerMaterialActions,
  type OwnerActionState,
} from "../src/features/materials/utils/owner-material-actions";
import {
  fixtureMaterial,
  materialOtherId,
  materialOwnerId,
} from "./fixtures/materials-data";

test("archived pages keep server status, opaque cursor and AbortSignal; owner reads validate ID and ownership", async () => {
  const row = fixtureMaterial({ status: "ARCHIVED" });
  const signal = new AbortController().signal;
  const api = createMaterialsApi(async (path, options) => {
    assert.equal(options?.signal, signal);
    if (!path.includes("?")) {
      assert.equal(path, `/me/materials/${row.id}`);
      return row;
    }
    const query = new URLSearchParams(path.split("?")[1]);
    assert.equal(query.get("status"), "ARCHIVED");
    assert.equal(query.get("cursor"), "next/+cursor");
    return {
      data: [row],
      meta: { pagination: { limit: 20, hasMore: false, nextCursor: null } },
    };
  }, materialOwnerId);
  assert.equal(
    (await api.minePage("next/+cursor", signal, "ARCHIVED")).items[0]!.id,
    row.id,
  );
  assert.equal((await api.ownerDetail(row.id, signal)).status, "ARCHIVED");
  for (const invalid of [
    { ...row, id: materialOtherId },
    { ...row, ownerId: materialOtherId },
  ])
    await assert.rejects(
      createMaterialsApi(async () => invalid, materialOwnerId).ownerDetail(
        row.id,
      ),
      (error) => error instanceof AppError && error.kind === "protocol",
    );
  await assert.rejects(
    createMaterialsApi(
      async () => ({
        data: [fixtureMaterial()],
        meta: { pagination: { limit: 20, hasMore: false, nextCursor: null } },
      }),
      materialOwnerId,
    ).minePage(undefined, signal, "ARCHIVED"),
  );
});

test("withdraw sends the exact listing version without replay; malformed receipts never unlock draft actions", async () => {
  const row = fixtureMaterial({ listingVersion: 8 });
  let calls = 0;
  const api = createMaterialsApi(async (path, options) => {
    calls++;
    assert.equal(path, `/me/materials/${row.id}/withdraw`);
    assert.equal(options?.method, "POST");
    assert.equal(options?.replayAfterRenewal, false);
    assert.deepEqual(options?.body, { expectedListingVersion: 7 });
    return row;
  }, materialOwnerId);
  assert.equal((await api.withdraw(row.id, 7)).status, "DRAFT");
  await assert.rejects(api.withdraw(row.id, 0));
  assert.equal(calls, 1);
  for (const invalid of [
    { ...row, status: "PUBLISHED" },
    { ...row, ownerId: materialOtherId },
    { ...row, id: materialOtherId },
  ])
    await assert.rejects(
      createMaterialsApi(async () => invalid, materialOwnerId).withdraw(
        row.id,
        7,
      ),
    );
});

test("unknown withdrawal reads its target without replaying POST, then resubmits the same material ID", async () => {
  const pending = fixtureMaterial({
    status: "PENDING_REVIEW",
    listingVersion: 7,
  });
  const draft = fixtureMaterial({ listingVersion: 8 });
  const writes: unknown[] = [],
    reads: string[] = [];
  let state: OwnerActionState = {};
  let result: unknown;
  const actions = createOwnerMaterialActions({
    api: {
      withdraw: async (id, version) => {
        writes.push(["withdraw", id, version]);
        throw new AppError("network");
      },
      ownerDetail: async (id) => {
        reads.push(id);
        return draft;
      },
      submit: async (id, version) => {
        writes.push(["submit", id, version]);
        return { ...draft, status: "PENDING_REVIEW" };
      },
      archive: async () => {
        throw Error("unexpected archive");
      },
      remove: async () => {
        throw Error("unexpected delete");
      },
    },
    isCurrent: () => true,
    onChange: (next) => {
      state = next;
    },
    onResult: async (row) => {
      result = row;
    },
    onDeleted: async () => {},
    onFailure() {},
  });
  await actions.run("withdraw", pending);
  assert.equal(state.uncertain?.action, "withdraw");
  await actions.run("submit", draft);
  assert.equal(writes.length, 1);
  await actions.reconcile();
  assert.equal(state.uncertain, undefined);
  assert.deepEqual(reads, [pending.id]);
  assert.deepEqual(result, draft);
  assert.equal(writes.length, 1, "reconciliation cannot replay withdrawal");
  await actions.run("submit", draft);
  assert.deepEqual(writes, [
    ["withdraw", pending.id, 7],
    ["submit", pending.id, 8],
  ]);
});

test("archived deletion retries its original ID/version after uncertainty and does not infer success from 404", async () => {
  const archived = fixtureMaterial({ status: "ARCHIVED", listingVersion: 4 });
  const versions: number[] = [],
    removed: string[] = [];
  let state: OwnerActionState = {};
  const actions = createOwnerMaterialActions({
    api: {
      remove: async (id, version) => {
        versions.push(version);
        if (versions.length === 1) throw new AppError("network");
        return { id, deleted: true, replayed: true };
      },
      ownerDetail: async () => {
        throw new AppError("http", 404);
      },
      withdraw: async () => {
        throw Error("unexpected withdraw");
      },
      submit: async () => {
        throw Error("unexpected submit");
      },
      archive: async () => {
        throw Error("unexpected archive");
      },
    },
    isCurrent: () => true,
    onChange: (next) => {
      state = next;
    },
    onResult: async () => {
      throw Error("delete is not a material receipt");
    },
    onDeleted: async (id) => {
      removed.push(id);
    },
    onFailure() {},
  });
  await actions.run("delete", archived);
  assert.equal(state.uncertain?.action, "delete");
  await actions.run("delete", { ...archived, listingVersion: 5 });
  assert.deepEqual(versions, [4]);
  assert.deepEqual(removed, []);
  await actions.reconcile();
  assert.deepEqual(versions, [4, 4]);
  assert.deepEqual(removed, [archived.id]);
  assert.equal(state.uncertain, undefined);
});

test("lifecycle conflicts never retry automatically; a new explicit action sends the refreshed row version", async () => {
  for (const action of ["submit", "archive"] as const) {
    const row = fixtureMaterial({
      status: action === "submit" ? "ARCHIVED" : "PUBLISHED",
      listingVersion: 3,
    });
    const calls: unknown[] = [];
    const conflict = new AppError("http", 409, "MATERIAL_VERSION_CONFLICT");
    const api = createMaterialsApi(async (path, options) => {
      calls.push([path, options?.body]);
      if (calls.length === 1) throw conflict;
      return fixtureMaterial({
        status: action === "submit" ? "PENDING_REVIEW" : "ARCHIVED",
        hasBeenPublished: true,
        listingVersion: 5,
      });
    }, materialOwnerId);
    let state: OwnerActionState = {};
    let invalidations = 0;
    let results = 0;
    const actions = createOwnerMaterialActions({
      api,
      isCurrent: () => true,
      onChange: (value) => {
        state = value;
      },
      onResult: async () => {
        results++;
      },
      onDeleted: async () => {},
      onFailure: () => {
        invalidations++;
      },
    });
    await actions.run(action, row);
    assert.equal(state.error, conflict);
    assert.equal(state.uncertain, undefined);
    assert.equal(invalidations, 1);
    await actions.reconcile();
    assert.equal(calls.length, 1, "a known conflict cannot replay a mutation");
    await actions.run(action, { ...row, listingVersion: 4 });
    assert.deepEqual(
      calls,
      [3, 4].map((expectedListingVersion) => [
        `/me/materials/${row.id}/${action}`,
        { expectedListingVersion },
      ]),
    );
    assert.equal(results, 1);
  }
});
