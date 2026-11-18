import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { AuditLogResponse } from "../dist/modules/audit/presentation/http/audit.responses.js";

test("audit Swagger describes nullable metadata as strings for generated clients", () => {
  for (const field of [
    "actorKind",
    "actorId",
    "actorRole",
    "systemActor",
    "reason",
    "requestId",
    "correlationId",
  ]) {
    const property = Reflect.getMetadata(
      "swagger/apiModelProperties",
      AuditLogResponse.prototype,
      field,
    );
    assert.equal(property.type, String, field);
    assert.equal(property.nullable, true, field);
  }
});

const imported =
  await import("../dist/modules/audit/application/services/audit-reader.js").catch(
    () => ({}),
  );
const admin = {
  userId: "11111111-1111-4111-8111-111111111111",
  roles: ["ADMIN"],
  permissions: ["audit:read"],
};
const time = new Date("2026-11-18T00:00:00.000Z");
const row = (n) => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
  actorId: admin.userId,
  actorRole: "ADMIN",
  actorRoles: ["ADMIN"],
  actorKind: "HUMAN",
  systemActor: null,
  action: "MATERIAL_MODERATE",
  targetType: "MATERIAL",
  targetId: "material-1",
  reason: "Reviewed",
  createdAt: time,
  requestId: null,
  correlationId: null,
  before: { status: "PENDING" },
  after: { status: "PUBLISHED", version: 2, storageKey: "private-key" },
  ipAddress: "private-ip",
  userAgent: "private-agent",
});
function fixture(rows = [row(3), row(2), row(1)]) {
  assert.equal(
    typeof imported.AuditReader,
    "function",
    "AuditReader must expose the new audit read contract",
  );
  const calls = [];
  const reader = new imported.AuditReader({
    auditLog: {
      findMany: async (query) => {
        calls.push(query);
        const boundary = query.where.AND?.[0]?.OR;
        return rows
          .filter(
            (entry) =>
              !boundary ||
              entry.createdAt < boundary[0].createdAt.lt ||
              (entry.createdAt.getTime() === boundary[1].createdAt.getTime() &&
                entry.id < boundary[1].id.lt),
          )
          .slice(0, query.take);
      },
    },
  });
  return { reader, calls };
}
test("audit list rejects roles and missing permission before database access", async () => {
  const { reader, calls } = fixture();
  for (const actor of [
    { ...admin, roles: ["STAFF"] },
    { ...admin, roles: ["USER"] },
    { ...admin, permissions: [] },
  ]) {
    await assert.rejects(
      reader.list(actor, {}),
      /AUDIT_READ_PERMISSION_REQUIRED/,
    );
  }
  assert.equal(calls.length, 0);
});
test("audit uses descending timestamp/id cursor and withholds snapshots and private request fields", async () => {
  const { reader, calls } = fixture();
  const first = await reader.list(admin, { limit: 2 });
  assert.deepEqual(
    first.data.map((entry) => entry.id),
    [row(3).id, row(2).id],
  );
  assert.equal(first.pagination.hasMore, true);
  for (const field of ["before", "after", "ipAddress", "userAgent"])
    assert.equal(field in first.data[0], false);
  const second = await reader.list(admin, {
    limit: 2,
    cursor: first.pagination.nextCursor,
  });
  assert.deepEqual(
    second.data.map((entry) => entry.id),
    [row(1).id],
  );
  assert.equal(second.pagination.nextCursor, null);
  assert.equal(second.pagination.hasMore, false);
  assert.deepEqual(calls[0].orderBy, [{ createdAt: "desc" }, { id: "desc" }]);
  assert.equal(calls[0].take, 3);
  await assert.rejects(
    reader.list(
      { ...admin, userId: row(1).id },
      { cursor: first.pagination.nextCursor },
    ),
    /INVALID_CURSOR/,
  );
  await assert.rejects(
    reader.list(admin, {
      cursor: first.pagination.nextCursor,
      action: "MATERIAL_MODERATE",
    }),
    /INVALID_CURSOR/,
  );
});
test("audit filters actor, target, action and half-open absolute time range before pagination", async () => {
  const { reader, calls } = fixture([]);
  await reader.list(admin, {
    actorId: admin.userId,
    targetType: "MATERIAL",
    targetId: "material-1",
    action: "MATERIAL_MODERATE",
    from: "2026-11-18T07:00:00+07:00",
    to: "2026-11-19T00:00:00Z",
  });
  assert.deepEqual(calls[0].where, {
    actorId: admin.userId,
    targetType: "MATERIAL",
    targetId: "material-1",
    action: "MATERIAL_MODERATE",
    createdAt: { gte: time, lt: new Date("2026-11-19T00:00:00Z") },
  });
  for (const query of [
    { limit: 0 },
    { limit: 101 },
    { from: "2026-02-30T00:00:00Z" },
    { from: "2026-11-19T00:00:00Z", to: "2026-11-18T00:00:00Z" },
    { from: "2026-11-18T00:00:00Z", to: "2026-11-18T00:00:00Z" },
    { actorId: "bad" },
    { targetType: "" },
    { targetId: "" },
    { action: "" },
  ]) {
    await assert.rejects(reader.list(admin, query), /INVALID_AUDIT/);
  }
  assert.equal(calls.length, 1);
});
test("internal target history preserves owner-readable snapshots and binds cursor to its target", async () => {
  const { reader, calls } = fixture();
  const query = {
    targetType: "MATERIAL",
    targetId: "material-1",
    action: "MATERIAL_MODERATE",
    limit: 1,
  };
  const result = await reader.readTarget(query);
  assert.deepEqual(result.data[0].before, { status: "PENDING" });
  assert.equal(result.data[0].after.version, 2);
  assert.equal(calls[0].where.targetId, "material-1");
  await assert.rejects(
    reader.readTarget({
      ...query,
      targetId: "material-2",
      cursor: result.pagination.nextCursor,
    }),
    /INVALID_CURSOR/,
  );
  await assert.rejects(
    reader.list(admin, { cursor: result.pagination.nextCursor }),
    /INVALID_CURSOR/,
  );
});
