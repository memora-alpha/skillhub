import assert from "node:assert/strict";
import { test } from "node:test";
import { SystemConfigurationService } from "../dist/modules/system-configuration/application/system-configuration.service.js";
import { seedApprovedConfigurations } from "../dist/modules/system-configuration/application/seed-configuration.js";
import { CONFIGURATION_DEFINITIONS } from "../dist/modules/system-configuration/domain/configuration.catalog.js";

const now = new Date("2026-10-05T00:00:00.000Z");

function fakeRepository() {
  const rows = new Map();
  const revisions = new Map();
  return {
    rows,
    revisions,
    async databaseNow() {
      return now;
    },
    async findCurrent(keys) {
      return keys.flatMap((key) => (rows.has(key) ? [rows.get(key)] : []));
    },
    async insertMissing(_tx, key, value, effectiveAt) {
      if (rows.has(key)) return false;
      rows.set(key, { key, value, version: 1, effectiveAt });
      return true;
    },
    async hasRevision(_tx, key, version) {
      return revisions.has(`${key}:${version}`);
    },
    async insertRevision(_tx, revision) {
      revisions.set(`${revision.key}:${revision.version}`, revision);
    },
  };
}

test("seed inserts approved values and history, rerun preserves operator value", async () => {
  const repo = fakeRepository();
  await seedApprovedConfigurations({}, repo);
  assert.equal(repo.rows.get("storage.evidenceMaxBytes").value, 10_000_000);
  assert.equal(
    repo.revisions.size,
    Object.keys(CONFIGURATION_DEFINITIONS).length,
  );
  repo.rows.set("storage.downloadTtlSeconds", {
    key: "storage.downloadTtlSeconds",
    value: 60,
    version: 2,
    effectiveAt: now,
  });
  await seedApprovedConfigurations({}, repo);
  assert.equal(repo.rows.get("storage.downloadTtlSeconds").value, 60);
  assert.equal(repo.rows.get("storage.downloadTtlSeconds").version, 2);
  assert.equal(repo.revisions.get("storage.downloadTtlSeconds:2").value, 60);
});

test("reader returns value/version snapshot and fails closed for missing/future policy", async () => {
  const repo = fakeRepository();
  const service = new SystemConfigurationService(repo, { now: () => now });
  await assert.rejects(
    () => service.getSnapshot(["storage.evidenceMaxBytes"]),
    /Configuration not ready/,
  );
  await seedApprovedConfigurations({}, repo);
  const snapshot = await service.getSnapshot([
    "storage.evidenceMaxBytes",
    "storage.downloadTtlSeconds",
  ]);
  assert.equal(snapshot.values["storage.evidenceMaxBytes"], 10_000_000);
  assert.equal(snapshot.versions["storage.evidenceMaxBytes"], 1);
  repo.rows.get("storage.evidenceMaxBytes").effectiveAt = new Date(
    now.getTime() + 1,
  );
  await assert.rejects(
    () => service.getSnapshot(["storage.evidenceMaxBytes"]),
    /Configuration not ready/,
  );
});

test("seed rejects invalid existing fixed policy instead of overwriting it", async () => {
  const repo = fakeRepository();
  repo.rows.set("credit.topUpVndPerCredit", {
    key: "credit.topUpVndPerCredit",
    value: 500,
    version: 1,
    effectiveAt: now,
  });
  await assert.rejects(
    () => seedApprovedConfigurations({}, repo),
    /requires reconciliation: credit.topUpVndPerCredit/,
  );
  assert.equal(repo.rows.get("credit.topUpVndPerCredit").value, 500);
});
