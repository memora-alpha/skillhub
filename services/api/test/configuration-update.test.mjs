import assert from "node:assert/strict";
import { test } from "node:test";
import { validateAuditInput } from "../dist/modules/audit/domain/audit-action.catalog.js";
import { SystemConfigurationService } from "../dist/modules/system-configuration/application/system-configuration.service.js";
import { UpdateConfigurationUseCase } from "../dist/modules/system-configuration/application/update-configuration.use-case.js";
import { CONFIGURATION_DEFINITIONS } from "../dist/modules/system-configuration/domain/configuration.catalog.js";

const now = new Date("2026-10-05T00:00:00.000Z");
const context = {
  requestId: "c3834caf-1193-4de1-a747-d06ca611502e",
  correlationId: "10aa9290-51c4-4169-b6e7-f0d2b5b6c629",
};

function fixture() {
  let state = {
    rows: new Map(
      Object.entries(CONFIGURATION_DEFINITIONS).map(([key, definition]) => [
        key,
        {
          key,
          value: structuredClone(definition.defaultValue),
          version: 1,
          effectiveAt: now,
        },
      ]),
    ),
    revisions: [],
    audits: [],
  };
  const repository = {
    async databaseNow() {
      return now;
    },
    async findCurrent(keys, tx) {
      const source = tx?.state ?? state;
      return keys.map((key) => source.rows.get(key)).filter(Boolean);
    },
    async insertMissing(tx, key, value, effectiveAt) {
      if (tx.state.rows.has(key)) return false;
      tx.state.rows.set(key, { key, value, version: 1, effectiveAt });
      return true;
    },
    async updateIfVersion(tx, key, version, value, effectiveAt) {
      const row = tx.state.rows.get(key);
      if (!row || row.version !== version) return false;
      tx.state.rows.set(key, { key, value, version: version + 1, effectiveAt });
      return true;
    },
    async insertRevision(tx, revision) {
      tx.state.revisions.push(revision);
    },
  };
  const transactions = {
    async run(work) {
      const copy = structuredClone(state);
      const result = await work({ state: copy });
      state = copy;
      return result;
    },
  };
  let failAudit = false;
  const audit = {
    validate: validateAuditInput,
    async append(tx, input) {
      if (failAudit) throw new Error("audit unavailable");
      tx.state.audits.push(input);
      return { auditId: "b8f10566-2df5-4f5c-9742-5df2e012d2e9" };
    },
  };
  const reader = new SystemConfigurationService(repository, { now: () => now });
  return {
    state: () => state,
    setAuditFailure: (value) => {
      failAudit = value;
    },
    useCase: new UpdateConfigurationUseCase(
      transactions,
      repository,
      audit,
      reader,
    ),
  };
}

function command(value = 60, version = 1) {
  return {
    changes: [{ key: "storage.downloadTtlSeconds", value }],
    expectedVersions: { "storage.downloadTtlSeconds": version },
    actor: { kind: "SYSTEM", name: "CONFIG_OPERATOR" },
    reason: "Adjust signed download lifetime",
    context,
  };
}

test("audited update writes current, revision and audit atomically", async () => {
  const fx = fixture();
  const result = await fx.useCase.execute(command());
  assert.equal(result.values["storage.downloadTtlSeconds"], 60);
  assert.equal(result.versions["storage.downloadTtlSeconds"], 2);
  assert.equal(
    fx.state().revisions[0].auditId,
    "b8f10566-2df5-4f5c-9742-5df2e012d2e9",
  );
  assert.equal(fx.state().audits[0].action, "SYSTEM_CONFIGURATION_UPDATE");
  assert.deepEqual(fx.state().audits[0].before, { value: 120, version: 1 });
});

test("stale version, invalid patch and audit failure preserve committed state", async () => {
  const fx = fixture();
  await fx.useCase.execute(command());
  await assert.rejects(
    () => fx.useCase.execute(command(30, 1)),
    /Configuration version conflict/,
  );
  await assert.rejects(
    () =>
      fx.useCase.execute({
        ...command(30, 2),
        effectiveAt: new Date(now.getTime() + 1000),
      }),
    /Invalid configuration patch/,
  );
  await assert.rejects(
    () => fx.useCase.execute({ ...command(30, 2), reason: "" }),
    /Invalid audit input/,
  );
  fx.setAuditFailure(true);
  await assert.rejects(
    () => fx.useCase.execute(command(30, 2)),
    /audit unavailable/,
  );
  assert.equal(fx.state().rows.get("storage.downloadTtlSeconds").value, 60);
  assert.equal(fx.state().revisions.length, 1);
  assert.equal(fx.state().audits.length, 1);
});

test("invalid multi-key patch and unverified human actor fail closed", async () => {
  const fx = fixture();
  await assert.rejects(
    () =>
      fx.useCase.execute({
        ...command(),
        changes: [
          command().changes[0],
          { key: "credit.topUpVndPerCredit", value: 2000 },
        ],
        expectedVersions: {
          "storage.downloadTtlSeconds": 1,
          "credit.topUpVndPerCredit": 1,
        },
      }),
    /Invalid configuration patch/,
  );
  await assert.rejects(
    () =>
      fx.useCase.execute({
        ...command(),
        actor: { kind: "HUMAN", userId: context.requestId, roles: ["ADMIN"] },
      }),
    /authorization unavailable/,
  );
  assert.equal(fx.state().revisions.length, 0);
});
