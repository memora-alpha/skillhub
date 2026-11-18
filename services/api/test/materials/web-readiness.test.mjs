import assert from "node:assert/strict";
import { test } from "node:test";
import { MaterialCatalogService } from "../../dist/modules/materials/application/services/material-catalog.service.js";
import { MaterialFavoritesService } from "../../dist/modules/materials/application/services/material-favorites.service.js";
import { MaterialModerationService } from "../../dist/modules/materials/application/services/material-moderation.service.js";
import { MaterialsService } from "../../dist/modules/materials/application/services/materials.service.js";

const actor = {
  userId: "00000000-0000-4000-8000-000000000001",
  roles: ["STAFF"],
  permissions: ["material:access", "material:moderate"],
};
const ownerId = "00000000-0000-4000-8000-000000000002";
const filters = {
  q: " Kubernetes ",
  ownerId,
  from: "2026-11-01T00:00:00.000Z",
  to: "2026-12-01T00:00:00.000Z",
};

function capture() {
  let query;
  const tx = {
    material: {
      findMany: async (input) => {
        query = input;
        return [];
      },
      count: async () => 0,
    },
    materialFavorite: {
      findMany: async (input) => {
        query = input;
        return [];
      },
    },
  };
  return { transactions: { run: (run) => run(tx) }, query: () => query };
}

function assertMaterialFilters(where) {
  assert.equal(where.ownerId, ownerId);
  assert.deepEqual(where.createdAt, {
    gte: new Date(filters.from),
    lt: new Date(filters.to),
  });
  assert.deepEqual(where.OR, [
    { title: { contains: "Kubernetes", mode: "insensitive" } },
    { description: { contains: "Kubernetes", mode: "insensitive" } },
  ]);
}

test("catalog applies owner and half-open material creation range before page limit", async () => {
  const f = capture();
  const catalog = new MaterialCatalogService(f.transactions, {}, {}, {});
  await catalog.search({ ...filters, page: 2, limit: 1 });
  assertMaterialFilters(f.query().where);
  assert.equal(f.query().skip, 1);
  assert.equal(f.query().take, 1);
  assert.equal(f.query().where.status, "PUBLISHED");
});

test("catalog rejects reversed and malformed time ranges before querying", async () => {
  const f = capture();
  const catalog = new MaterialCatalogService(f.transactions, {}, {}, {});
  for (const range of [
    { from: filters.to, to: filters.from },
    { from: "bad" },
    { from: "2026-02-30T00:00:00.000Z" },
    { from: "2026-11-18T00:00:00" },
    { from: filters.from, to: filters.from },
  ]) {
    await assert.rejects(
      async () => catalog.search({ ...range, page: 1, limit: 20 }),
      /INVALID_MATERIAL_TIME_RANGE/,
    );
  }
  assert.equal(f.query(), undefined);
});

test("staff material search filters are applied before the bounded query", async () => {
  const f = capture();
  const moderation = new MaterialModerationService(f.transactions, {});
  await moderation.queue(actor, "PENDING_REVIEW", { ...filters, limit: 1 });
  assertMaterialFilters(f.query().where);
  assert.equal(f.query().take, 2);
});

test("staff ALL mode searches every staff-visible state while excluding owner-private drafts", async () => {
  const f = capture();
  const moderation = new MaterialModerationService(f.transactions, {});
  await moderation.queue(actor, "ALL", { ...filters, limit: 1 });
  assert.deepEqual(f.query().where.status, {
    in: ["PENDING_REVIEW", "PUBLISHED", "REJECTED", "HIDDEN", "ARCHIVED"],
  });
  assertMaterialFilters(f.query().where);
  assert.equal(f.query().take, 2);
});

test("saved library filters stay inside caller and published material scopes", async () => {
  const f = capture();
  const favorites = new MaterialFavoritesService(f.transactions, {});
  await favorites.list(actor, { ...filters, limit: 1 });
  const where = f.query().where;
  assert.equal(where.userId, actor.userId);
  assertMaterialFilters(where.materialIdRecord);
  assert.equal(where.materialIdRecord.status, "PUBLISHED");
  assert.equal(f.query().take, 2);
});

test("owner search cannot replace the authenticated owner scope", async () => {
  const f = capture();
  const materials = new MaterialsService(f.transactions, {}, {}, {});
  await materials.listMine(actor, { ...filters, limit: 1 });
  assert.equal(f.query().where.ownerId, actor.userId);
  assert.equal(f.query().where.OR[0].title.contains, "Kubernetes");
  assert.equal(f.query().take, 2);
});

test("moderation history requires permission before reading material or audit data", async () => {
  let read = false;
  const moderation = new MaterialModerationService(
    {
      run: async () => {
        read = true;
      },
    },
    {},
    {
      readTarget: async () => {
        read = true;
      },
    },
  );
  assert.equal(typeof moderation.history, "function");
  await assert.rejects(
    () => moderation.history({ ...actor, permissions: [] }, ownerId, {}),
    /STAFF_ACCESS_REQUIRED/,
  );
  assert.equal(read, false);
});

test("moderation history projects safe actor, action, timestamp and version fields", async () => {
  const at = new Date("2026-11-18T00:00:00.000Z");
  let readQuery;
  const moderation = new MaterialModerationService(
    {
      run: (run) =>
        run({ material: { findUnique: async () => ({ id: ownerId }) } }),
    },
    {},
    {
      readTarget: async (query) => {
        readQuery = query;
        return {
          data: [
            {
              id: ownerId,
              actorKind: "HUMAN",
              actorId: actor.userId,
              actorRoles: ["STAFF"],
              createdAt: at,
              reason: "Reviewed",
              before: { status: "PENDING_REVIEW", listingVersion: 4 },
              after: {
                status: "PUBLISHED",
                listingVersion: 5,
                storageKey: "do-not-return",
              },
            },
          ],
          pagination: { limit: 1, hasMore: false, nextCursor: null },
        };
      },
    },
  );
  assert.equal(typeof moderation.history, "function");
  const result = await moderation.history(actor, ownerId, { limit: 1 });
  assert.deepEqual(readQuery, {
    targetType: "MATERIAL",
    targetId: ownerId,
    action: "MATERIAL_MODERATE",
    limit: 1,
  });
  assert.deepEqual(result.data[0], {
    id: ownerId,
    action: "approve",
    actor: {
      kind: "HUMAN",
      userId: actor.userId,
      roles: ["STAFF"],
      systemActor: null,
    },
    occurredAt: at,
    reason: "Reviewed",
    previousStatus: "PENDING_REVIEW",
    status: "PUBLISHED",
    reviewedListingVersion: 4,
    listingVersion: 5,
  });
  assert.doesNotMatch(JSON.stringify(result), /storageKey|do-not-return/);
});
