import "reflect-metadata";
import { test } from "node:test";
import assert from "node:assert/strict";
import { SkillsRepository } from "../../dist/modules/skills/infrastructure/persistence/skills.repository.js";
import { SkillsService } from "../../dist/modules/skills/application/services/skills.service.js";
import { SharingSkillsRepository } from "../../dist/modules/sharing-skills/infrastructure/persistence/sharing-skills.repository.js";
import { SharingSkillsService } from "../../dist/modules/sharing-skills/application/services/sharing-skills.service.js";

const owner = "00000000-0000-4000-8000-000000000001";
const other = "00000000-0000-4000-8000-000000000002";
const skillIds = [
  "10000000-0000-4000-8000-000000000003",
  "10000000-0000-4000-8000-000000000001",
  "10000000-0000-4000-8000-000000000002",
];
const offeringIds = [
  "20000000-0000-4000-8000-000000000001",
  "20000000-0000-4000-8000-000000000002",
  "20000000-0000-4000-8000-000000000003",
];

// Keep the application contracts and emitted SQL real; replace only PostgreSQL.
function fixture({
  snapshotPatch = {},
  lockedPatch = {},
  missingLocked = false,
  catalogStatus = "ACTIVE",
} = {}) {
  const statements = [];
  const snapshots = offeringIds.map((id, index) => ({
    id,
    userId: owner,
    skillId: skillIds[index],
    archivedAt: null,
    isVisible: true,
    ...snapshotPatch,
  }));
  const locked = snapshots.map((row) => ({ ...row, ...lockedPatch }));
  const lockedIds = new Set();
  const tx = {
    sharingSkill: {
      async findMany(query) {
        statements.push({ kind: "sharing-read", query });
        return snapshots.filter(({ id }) => query.where.id.in.includes(id));
      },
      async findUnique(query) {
        statements.push({ kind: "sharing-read", query });
        if (missingLocked && lockedIds.has(query.where.id)) return null;
        return (
          (lockedIds.has(query.where.id) ? locked : snapshots).find(
            ({ id }) => id === query.where.id,
          ) ?? null
        );
      },
    },
    skill: {
      async findUnique(query) {
        statements.push({ kind: "catalog-read", query });
        return { id: query.where.id, status: catalogStatus };
      },
    },
    async $queryRaw(query, ...parameters) {
      const sql = Array.isArray(query) ? query.join("?") : query.text;
      const values = Array.isArray(query) ? parameters : query.values;
      if (/FROM sharing_skills\b/iu.test(sql)) {
        statements.push({ kind: "sharing-lock", sql, values });
        values.forEach((id) => lockedIds.add(id));
        return missingLocked
          ? []
          : locked.filter(({ id }) => values.includes(id));
      }
      assert.match(sql, /FROM skills\b/iu);
      statements.push({ kind: "catalog-lock", sql, values });
      return [...new Set(values)].map((id) => ({ id, status: catalogStatus }));
    },
  };
  const skills = new SkillsService(new SkillsRepository(tx));
  const sharing = new SharingSkillsService(
    new SharingSkillsRepository(tx),
    skills,
  );
  return { sharing, tx, statements };
}

test("offering validation uses three statements and orders catalog locks before sharing locks", async () => {
  for (const ids of [offeringIds.slice(0, 1), [...offeringIds].reverse()]) {
    const f = fixture();
    await f.sharing.assertRequestOfferings(f.tx, owner, ids);
    assert.equal(
      f.statements.length,
      3,
      "query count must stay bounded as selections grow",
    );
    assert.deepEqual(
      f.statements.map(({ kind }) => kind),
      ["sharing-read", "catalog-lock", "sharing-lock"],
    );
    assert.match(f.statements[1].sql, /ORDER BY skill_id\s+FOR UPDATE/iu);
    assert.match(
      f.statements[2].sql,
      /ORDER BY sharing_skill_id\s+FOR UPDATE/iu,
    );
    assert.deepEqual(f.statements[0].query.select, {
      id: true,
      userId: true,
      skillId: true,
    });
  }
});

test("empty offerings skip storage and duplicate offerings validate once", async () => {
  const f = fixture();
  await f.sharing.assertRequestOfferings(f.tx, owner, []);
  assert.equal(f.statements.length, 0);
  await f.sharing.assertRequestOfferings(f.tx, owner, [
    offeringIds[0],
    offeringIds[0],
  ]);
  assert.equal(f.statements.length, 3);
});

test("changed or unavailable selections reject before the caller writes", async (t) => {
  for (const [name, options, status, message] of [
    ["foreign snapshot", { snapshotPatch: { userId: other } }, 404],
    [
      "inactive catalog",
      { catalogStatus: "INACTIVE" },
      409,
      "SKILL_NOT_ACTIVE",
    ],
    [
      "changed catalog selection",
      { lockedPatch: { skillId: skillIds[1] } },
      409,
    ],
    ["changed ownership", { lockedPatch: { userId: other } }, 404],
    ["deleted selection", { missingLocked: true }, 404],
    [
      "archived selection",
      { lockedPatch: { archivedAt: new Date("2026-10-12T00:00:00Z") } },
      409,
      "SHARING_SKILL_ARCHIVED",
    ],
    [
      "hidden selection",
      { lockedPatch: { isVisible: false } },
      409,
      "SHARING_SKILL_NOT_VISIBLE",
    ],
  ]) {
    await t.test(name, async () => {
      const f = fixture(options);
      let written = false;
      await assert.rejects(
        async () => {
          await f.sharing.assertRequestOfferings(f.tx, owner, [offeringIds[0]]);
          written = true;
        },
        (error) =>
          error.getStatus?.() === status &&
          (!message || error.message === message),
      );
      assert.equal(written, false);
      if (name === "foreign snapshot")
        assert.deepEqual(
          f.statements.map(({ kind }) => kind),
          ["sharing-read"],
        );
    });
  }
});
