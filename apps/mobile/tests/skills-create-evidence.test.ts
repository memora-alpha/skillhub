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
  let created: typeof skill | undefined;
  let files = true;
  const evidence = {
    hasFiles: () => files,
    valid: () => true,
    preserveDraft: (id: string) => {
      assert.equal(id, ids.sharing);
      calls.push("preserve");
    },
    submitForSkill: async (id: string) => {
      assert.equal(id, ids.sharing);
      calls.push("upload-scan-submit");
    },
  };
  const run = () =>
    saveSkill({
      api: {
        create: async () => {
          calls.push("create");
          return skill;
        },
        update: async () => {
          calls.push("update");
          return skill;
        },
      },
      input: skillInput(formValues(skill)),
      previous: created,
      key: "save-key",
      evidence,
      assertCurrent: () => {},
      onSaved: async (saved, isCreated) => {
        calls.push(isCreated ? "remember-create" : "remember-existing");
        created = saved;
      },
    });
  return {
    calls,
    evidence,
    run,
    setFiles: (value: boolean) => {
      files = value;
    },
  };
}

test("save creates and remembers the skill before uploading evidence under its returned ID", async () => {
  const f = fixture();
  const result = await f.run();
  assert.deepEqual(f.calls, [
    "create",
    "remember-create",
    "preserve",
    "upload-scan-submit",
  ]);
  assert.equal(result.evidenceSent, true);
  assert.equal(result.skill.id, ids.sharing);
});

test("evidence failure returns the saved skill with an error and retry does not create or patch it again", async () => {
  const f = fixture();
  const send = f.evidence.submitForSkill;
  const error = new Error("upload unavailable");
  f.evidence.submitForSkill = async () => {
    throw error;
  };
  const result = await f.run();
  assert.equal(result.skill.id, ids.sharing);
  assert.equal(result.evidenceSent, false);
  assert.equal(result.evidenceFailure?.error, error);
  f.evidence.submitForSkill = send;
  assert.equal((await f.run()).evidenceSent, true);
  assert.equal(f.calls.filter((call) => call === "create").length, 1);
  assert.equal(f.calls.filter((call) => call === "update").length, 0);
});

test("save without files completes after create and does not upload or submit", async () => {
  const f = fixture();
  f.setFiles(false);
  assert.equal((await f.run()).evidenceSent, false);
  assert.deepEqual(f.calls, ["create", "remember-create"]);
});

test("invalid evidence metadata prevents creation and all file writes", async () => {
  const f = fixture();
  f.evidence.valid = () => false;
  await assert.rejects(f.run(), /tiêu đề/);
  assert.deepEqual(f.calls, []);
});

test("a user can remove failed evidence and finish the already-created skill without another create", async () => {
  const f = fixture();
  f.evidence.submitForSkill = async () => {
    throw new Error("scan unavailable");
  };
  assert.ok((await f.run()).evidenceFailure);
  f.setFiles(false);
  assert.equal((await f.run()).evidenceSent, false);
  assert.equal(f.calls.filter((call) => call === "create").length, 1);
  assert.equal(f.calls.filter((call) => call === "update").length, 0);
});

test("a failed skill create remains a failure without starting evidence or caching a skill", async () => {
  const skill = ownSkillSchema.parse(ownSkill);
  const calls: string[] = [];
  await assert.rejects(
    saveSkill({
      api: {
        create: async () => {
          throw new Error("create unavailable");
        },
        update: async () => skill,
      },
      input: skillInput(formValues(skill)),
      key: "failed-create",
      evidence: {
        hasFiles: () => true,
        valid: () => true,
        preserveDraft: () => calls.push("draft"),
        submitForSkill: async () => {
          calls.push("evidence");
        },
      },
      assertCurrent: () => {},
      onSaved: async () => {
        calls.push("cache");
      },
    }),
    /create unavailable/,
  );
  assert.deepEqual(calls, []);
});

test("account change during evidence failure cannot produce a saved result for the new session", async () => {
  const skill = ownSkillSchema.parse(ownSkill);
  let current = true;
  await assert.rejects(
    saveSkill({
      api: { create: async () => skill, update: async () => skill },
      input: skillInput(formValues(skill)),
      key: "old-session",
      evidence: {
        hasFiles: () => true,
        valid: () => true,
        preserveDraft: () => {},
        submitForSkill: async () => {
          current = false;
          throw new Error("evidence unavailable");
        },
      },
      assertCurrent: () => {
        if (!current) throw new Error("session changed");
      },
      onSaved: async () => {},
    }),
    /session changed/,
  );
});

test("account change during create stops owner-cache writes and subsequent evidence requests", async () => {
  const skill = ownSkillSchema.parse(ownSkill);
  let current = true;
  const calls: string[] = [];
  await assert.rejects(
    saveSkill({
      api: {
        create: async () => {
          current = false;
          return skill;
        },
        update: async () => skill,
      },
      input: skillInput(formValues(skill)),
      key: "old-session-key",
      evidence: {
        hasFiles: () => true,
        valid: () => true,
        preserveDraft: () => calls.push("draft"),
        submitForSkill: async () => {
          calls.push("upload");
        },
      },
      assertCurrent: () => {
        if (!current) throw new Error("session changed");
      },
      onSaved: async () => {
        calls.push("cache");
      },
    }),
    /session changed/,
  );
  assert.deepEqual(calls, []);
});
