import test from "node:test";
import assert from "node:assert/strict";
import { ownSkillSchema } from "../src/features/skills/api/skill-contracts";
import { saveSkill } from "../src/features/skills/utils/save-skill";
import {
  skillInput,
  formValues,
} from "../src/features/skills/schemas/skill-form";
import { ownSkill, ids } from "./skills-fixtures";

function fixture() {
  const skill = ownSkillSchema.parse(ownSkill);
  const calls: string[] = [];
  let previous: typeof skill | undefined;
  let files = true;
  const evidence = {
    hasFiles: () => files,
    valid: () => true,
    preserveDraft: (id: string) => {
      assert.equal(id, ids.sharing);
      calls.push("preserve");
    },
    queueForSkill: (id: string) => {
      assert.equal(id, ids.sharing);
      calls.push("queue");
      return true;
    },
  };
  const api = {
    create: async () => {
      calls.push("create");
      return skill;
    },
    update: async () => {
      calls.push("update");
      return skill;
    },
  };
  const run = (assertCurrent = () => {}) =>
    saveSkill({
      api,
      input: skillInput(formValues(skill)),
      previous,
      key: "save-key",
      evidence,
      assertCurrent,
      onSaved: async (saved, created) => {
        calls.push(created ? "remember-create" : "remember-existing");
        previous = saved;
      },
    });
  return {
    calls,
    evidence,
    api,
    run,
    setFiles: (value: boolean) => {
      files = value;
    },
  };
}

test("save returns a confirmed skill after queueing evidence without awaiting its upload", async () => {
  const f = fixture();
  const result = await f.run();
  assert.deepEqual(f.calls, ["create", "remember-create", "preserve", "queue"]);
  assert.equal(result.evidenceQueued, true);
  assert.equal(result.skill.id, ids.sharing);
});

test("retry after a queued save cannot create or patch the skill again", async () => {
  const f = fixture();
  await f.run();
  f.evidence.queueForSkill = () => false;
  assert.equal((await f.run()).evidenceQueued, false);
  assert.equal(f.calls.filter((call) => call === "create").length, 1);
  assert.equal(f.calls.filter((call) => call === "update").length, 0);
});

test("save without evidence completes without queueing a transfer", async () => {
  const f = fixture();
  f.setFiles(false);
  assert.equal((await f.run()).evidenceQueued, false);
  assert.deepEqual(f.calls, ["create", "remember-create"]);
});

test("invalid evidence metadata still prevents skill creation", async () => {
  const f = fixture();
  f.evidence.valid = () => false;
  await assert.rejects(f.run(), /tiêu đề/);
  assert.deepEqual(f.calls, []);
});

test("unconfirmed create cannot queue evidence or write owner caches", async () => {
  const f = fixture();
  f.api.create = async () => {
    throw new Error("create unavailable");
  };
  await assert.rejects(f.run(), /create unavailable/);
  assert.deepEqual(f.calls, []);
});

test("account change during create stops caching and transfer queueing", async () => {
  const f = fixture();
  let current = true;
  const create = f.api.create;
  f.api.create = async () => {
    const result = await create();
    current = false;
    return result;
  };
  await assert.rejects(
    f.run(() => {
      if (!current) throw new Error("session changed");
    }),
    /session changed/,
  );
  assert.deepEqual(f.calls, ["create"]);
});
