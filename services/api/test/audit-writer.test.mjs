import assert from "node:assert/strict";
import { test } from "node:test";
import { AuditWriter } from "../dist/modules/audit/application/services/audit-writer.js";
import { AuditRepository } from "../dist/modules/audit/infrastructure/persistence/audit.repository.js";

const input = {
  actor: { kind: "SYSTEM", name: "configuration-seed" },
  action: "SYSTEM_CONFIGURATION_UPDATE",
  target: { type: "SYSTEM_CONFIGURATION", id: "storage.downloadTtlSeconds" },
  before: { value: 120, version: 1 },
  after: { value: 60, version: 2 },
  reason: "  Restore shorter TTL  ",
  context: {
    requestId: "22222222-2222-4222-8222-222222222222",
    correlationId: "33333333-3333-4333-8333-333333333333",
  },
};

test("writer inserts only through the provided transaction and strips unvalidated text", async () => {
  const calls = [];
  const tx = {
    auditLog: {
      create: async (query) => {
        calls.push(query);
        return {};
      },
    },
  };
  const writer = new AuditWriter(new AuditRepository());
  const result = await writer.append(tx, input);
  assert.match(result.auditId, /^[0-9a-f-]{36}$/);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].data.id, result.auditId);
  assert.equal(calls[0].data.reason, "Restore shorter TTL");
  assert.equal(calls[0].data.actorKind, "SYSTEM");
  assert.equal(calls[0].data.actorId, null);
  assert.deepEqual(calls[0].data.actorRoles, []);
  assert.deepEqual(calls[0].data.before, { value: 120, version: 1 });
  assert.equal("createdAt" in calls[0].data, false);
});

test("invalid input is rejected before persistence and storage failure propagates", async () => {
  let calls = 0;
  const tx = {
    auditLog: {
      create: async () => {
        calls += 1;
        throw new Error("storage unavailable");
      },
    },
  };
  const writer = new AuditWriter(new AuditRepository());
  await assert.rejects(() => writer.append(tx, { ...input, reason: "  " }));
  assert.equal(calls, 0);
  await assert.rejects(() => writer.append(tx, input), /storage unavailable/);
  assert.equal(calls, 1);
});
