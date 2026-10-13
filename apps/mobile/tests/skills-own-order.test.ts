import assert from "node:assert/strict";
import test from "node:test";
import {
  ownSkillSchema,
  verificationSchema,
} from "../src/features/skills/api/skill-contracts";
import {
  ownSkillItems,
  recordCreatedSkillReads,
} from "../src/features/skills/utils/own-skill-order";
import { ownSkill, batch, ids } from "./skills-fixtures";

test("confirmed creates stay newest first after server UUID-order refresh or when absent from the loaded page", () => {
  const older = ownSkillSchema.parse({ ...ownSkill, id: ids.other });
  const first = ownSkillSchema.parse(ownSkill);
  const latest = { ...first, id: ids.file };
  const created = new Map([
    [first.id, first],
    [latest.id, latest],
  ]);
  assert.deepEqual(
    ownSkillItems([first, older], created, "ALL", new Set(), new Map()).map(
      (item) => item.id,
    ),
    [latest.id, first.id, older.id],
  );
  const fresh = {
    ...latest,
    version: 4,
    description: "Current data from the server",
  };
  assert.equal(
    ownSkillItems(
      [older, fresh, first],
      created,
      "ALL",
      new Set(),
      new Map(),
    )[0]?.version,
    4,
  );
  assert.equal(
    ownSkillItems([older, first, fresh], created, "ALL", new Set(), new Map())
      .length,
    3,
  );
});

test("updates never move a skill ahead of a newer create, and filters/deletes still apply", () => {
  const first = ownSkillSchema.parse(ownSkill);
  const latest = { ...first, id: ids.other };
  const created = new Map([
    [first.id, first],
    [latest.id, latest],
  ]);
  created.set(first.id, { ...first, version: 5 });
  assert.deepEqual(
    ownSkillItems([], created, "ALL", new Set(), new Map()).map(
      (item) => item.id,
    ),
    [latest.id, first.id],
  );
  assert.deepEqual(
    ownSkillItems([], created, "ALL", new Set([latest.id]), new Map()).map(
      (item) => item.id,
    ),
    [first.id],
  );
  const submitted = new Map([[first.id, verificationSchema.parse(batch)]]);
  assert.deepEqual(
    ownSkillItems([], created, "PENDING", new Set(), submitted).map(
      (item) => item.id,
    ),
    [first.id],
  );
  assert.deepEqual(
    ownSkillItems([], created, "VERIFIED", new Set(), submitted),
    [],
  );
});

test("partial pages retain confirmed creates, while a complete owner read removes externally deleted records", () => {
  const skill = ownSkillSchema.parse(ownSkill);
  const created = new Map([[skill.id, skill]]);
  recordCreatedSkillReads(created, []);
  assert.equal(created.size, 1);
  recordCreatedSkillReads(created, [{ ...skill, version: 3 }]);
  recordCreatedSkillReads(created, [skill]);
  assert.equal(created.get(skill.id)?.version, 3);
  recordCreatedSkillReads(created, [], true);
  assert.equal(created.size, 0);
});
