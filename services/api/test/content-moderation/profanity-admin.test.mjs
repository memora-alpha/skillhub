import assert from "node:assert/strict";
import test from "node:test";
import { ProfanityRulesUseCase } from "../../dist/modules/system-configuration/application/use-cases/profanity-rules.use-case.js";
import { defaultProfanityRuleSet } from "../../dist/modules/content-moderation/domain/profanity-rule-set.js";

const admin = {
  userId: "admin",
  roles: ["ADMIN"],
  permissions: ["content-moderation:configure"],
};
const staff = { ...admin, roles: ["STAFF"] };
const effectiveAt = new Date("2026-11-21T00:00:00Z");
const rule = {
  id: "extra",
  term: "cá tím",
  aliases: ["ca tim"],
  enabled: true,
};
const rules = [...defaultProfanityRuleSet.rules, rule];

test("admin can preview, apply one audited update, and roll back using the active version", async () => {
  const initial = { version: 1, value: defaultProfanityRuleSet, effectiveAt };
  let current = initial;
  const revisions = new Map([[1, initial]]);
  const audit = [];
  const tx = {
    $queryRaw: async () => [],
    systemConfigurationRevision: {
      findUnique: async ({ where }) => revisions.get(where.key_version.version),
      findMany: async () =>
        [...revisions.values()].sort((a, b) => b.version - a.version),
    },
  };
  const service = new ProfanityRulesUseCase(
    { run: (operation) => operation(tx) },
    { assertLive: async (_tx, actor) => actor },
    {
      findCurrent: async () => [current],
      databaseNow: async () => effectiveAt,
      updateIfVersion: async (_tx, _key, version, value) => {
        if (current.version !== version) return false;
        current = { version: version + 1, value, effectiveAt };
        return true;
      },
      insertRevision: async (_tx, snapshot) => {
        revisions.set(snapshot.version, snapshot);
      },
    },
    {
      validate: (input) => input,
      append: async (_tx, input) => {
        audit.push(input);
        return { auditId: "audit" };
      },
    },
  );
  const preview = await service.preview(admin, { rules, text: "CA TIM!" });
  assert.equal(preview.outcome, "BLOCK");
  assert.equal(preview.changeCount.added, 1);
  assert.equal((await service.get(admin)).version, 1);
  await assert.rejects(service.get(staff), { status: 403 });
  await assert.rejects(
    service.preview(admin, {
      rules: [...rules, { ...rule, id: "dup" }],
      text: "x",
    }),
    { status: 400 },
  );
  const approved = await service.update(
    admin,
    { expectedVersion: 1, rules, reason: "Add example" },
    {},
  );
  assert.equal(approved.version, 2);
  await assert.rejects(
    service.update(
      admin,
      { expectedVersion: 1, rules, reason: "Old draft" },
      {},
    ),
    { status: 409 },
  );
  const restored = await service.rollback(
    admin,
    { expectedVersion: 2, targetVersion: 1, reason: "Restore default" },
    {},
  );
  assert.equal(restored.version, 3);
  assert.deepEqual(restored.rules, defaultProfanityRuleSet.rules);
  assert.deepEqual(
    (await service.revisions(admin)).items.map(({ version }) => version),
    [3, 2, 1],
  );
  assert.deepEqual(
    audit.map(({ reason }) => reason),
    ["Add example", "Restore default"],
  );
});
