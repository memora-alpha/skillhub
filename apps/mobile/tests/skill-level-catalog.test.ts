import assert from "node:assert/strict";
import test from "node:test";
import { AppError } from "../src/lib/http/errors";
import {
  ownSkillSchema,
  publicSkillSchema,
  skillLevelSchema,
} from "../src/features/skills/api/skill-contracts";
import {
  formValues,
  skillFormSchema,
  skillInput,
  skillPatch,
} from "../src/features/skills/schemas/skill-form";
import {
  canSaveLevel,
  skillLevelLabel,
} from "../src/features/skills/utils/skill-level";
import { offeringSchema } from "../src/features/learning-requests/schemas/request-preferences";
import {
  ownOfferingSchema,
  ownerSchema,
  publicSchema,
} from "../src/features/learning-requests/types";
import {
  fixtureRequest,
  publicFixture,
} from "./fixtures/learning-requests-data";
import { harness, ids, ownSkill, skillLevel, success } from "./skills-fixtures";

const custom = skillLevelSchema.parse({
  ...skillLevel,
  id: ids.other,
  code: "B2",
  name: "Trung cao cấp (B2)",
  sortOrder: 10,
});
const customSkill = {
  ...ownSkill,
  level: custom.code,
  levelId: custom.id,
  skillLevel: custom,
};

test("level lookup reads a nonpaginated array, binds skill IDs, sorts and excludes inactive options", async () => {
  const h = harness(() => ({
    payload: success([
      custom,
      { ...skillLevel, id: ids.file, status: "INACTIVE" },
      skillLevel,
    ]),
  }));
  const levels = await h.api.levels(ids.skill);
  assert.deepEqual(
    levels.map((level) => level.id),
    [ids.level, ids.other],
  );
  assert.equal(h.calls[0]?.url, `/skills/${ids.skill}/levels`);
  assert.deepEqual(
    await harness(() => ({ payload: success([]) })).api.levels(ids.skill),
    [],
  );
});

test("level lookup rejects malformed, repeated and cross-skill data instead of offering it", async () => {
  for (const data of [
    { data: [skillLevel] },
    [skillLevel, skillLevel],
    [{ ...skillLevel, skillId: ids.other }],
    [{ ...skillLevel, name: "" }],
  ])
    await assert.rejects(
      harness(() => ({ payload: success(data) })).api.levels(ids.skill),
      (error) => error instanceof AppError && error.kind === "protocol",
    );
});

test("dynamic projections show backend names and strip nested fields outside the display allowlist", () => {
  for (const schema of [ownSkillSchema, publicSkillSchema]) {
    const skill = schema.parse({
      ...customSkill,
      skillLevel: {
        ...custom,
        privateNotes: "secret",
        createdBy: ids.user,
      },
    });
    assert.equal(skillLevelLabel(skill), custom.name);
    assert.equal("privateNotes" in skill.skillLevel!, false);
    assert.equal("createdBy" in skill.skillLevel!, false);
  }
  assert.equal(skillLevelLabel({ level: "N3" }), "N3");
  assert.equal(
    skillLevelLabel({ level: "BEGINNER", skillLevel: null }),
    "Cơ bản",
  );
  assert.equal(
    publicSkillSchema.parse({ ...ownSkill, levelId: null, skillLevel: null })
      .level,
    "BEGINNER",
  );
});

test("nested level projection cannot refer to a different skill, ID or code", () => {
  for (const value of [
    { ...customSkill, levelId: ids.level },
    { ...customSkill, level: "BEGINNER" },
    { ...customSkill, skillLevel: { ...custom, skillId: ids.other } },
  ])
    assert.equal(publicSkillSchema.safeParse(value).success, false);
});

test("form requires explicit selection, sends only levelId and patches changed IDs", async () => {
  const skill = ownSkillSchema.parse(customSkill);
  const values = formValues(skill);
  assert.equal(values.levelId, custom.id);
  assert.equal(
    skillFormSchema.safeParse({ ...values, levelId: "" }).success,
    false,
  );
  assert.equal(formValues().levelId, "");
  const input = skillInput(values);
  assert.equal("level" in input, false);
  assert.deepEqual(skillPatch(skill, input), { expectedVersion: 1 });
  const patch = skillPatch(skill, { ...input, levelId: ids.level });
  assert.deepEqual(patch, { expectedVersion: 1, levelId: ids.level });
  const h = harness((config) => ({
    payload: success(config.method === "patch" ? ownSkill : customSkill),
  }));
  await h.api.create(input, "create-custom");
  await h.api.update(skill.id, patch, "update-custom");
  assert.equal(JSON.parse(h.calls[0]!.data).levelId, custom.id);
  assert.deepEqual(JSON.parse(h.calls[1]!.data), patch);
});

test("mutation rejects a successful response with a different selected level", async () => {
  const h = harness(() => ({ payload: success(ownSkill) }));
  const input = skillInput(formValues(ownSkillSchema.parse(customSkill)));
  await assert.rejects(h.api.create(input, "create"), AppError);
  await assert.rejects(
    h.api.update(
      ids.sharing,
      { expectedVersion: 1, levelId: custom.id },
      "edit",
    ),
    AppError,
  );
});

test("historical inactive selections can be preserved without reselecting; new selections must be ACTIVE", () => {
  const previous = ownSkillSchema.parse({
    ...customSkill,
    skillLevel: { ...custom, status: "INACTIVE" },
  });
  assert.equal(canSaveLevel(custom.id, [], previous), true);
  assert.equal(canSaveLevel(custom.id, undefined, previous), true);
  assert.deepEqual(
    skillPatch(previous, {
      ...skillInput(formValues(previous)),
      isVisible: true,
    }),
    { expectedVersion: 1, isVisible: true },
  );
  assert.equal(canSaveLevel(custom.id, []), false);
  assert.equal(canSaveLevel("", [custom]), false);
  assert.equal(canSaveLevel(custom.id, undefined), false);
  assert.equal(
    canSaveLevel(custom.id, [{ ...custom, status: "INACTIVE" }]),
    false,
  );
  assert.equal(
    canSaveLevel(
      ids.level,
      [{ ...custom, id: ids.level, skillId: ids.file }],
      previous,
    ),
    false,
  );
  assert.equal(
    canSaveLevel(ids.level, [skillLevelSchema.parse(skillLevel)], previous),
    true,
  );
});

test("Learning Request offered skills accept catalog codes and display names in own and public projections", () => {
  const offering = offeringSchema.parse({
    ...customSkill,
    skillLevel: {
      ...custom,
      privateNotes: "secret",
    },
  });
  assert.equal(offering.level, "B2");
  assert.deepEqual(offering.skillLevel, { name: custom.name });
  assert.equal(
    ownOfferingSchema.parse(customSkill).skillLevel?.name,
    custom.name,
  );
  const own = fixtureRequest({ offeredSharingSkills: [offering] });
  assert.equal(ownerSchema.parse(own).offeredSharingSkills[0]?.level, "B2");
  assert.equal(
    publicSchema.parse(
      publicFixture({
        actor: "10000000-0000-4000-8000-000000000001",
        request: own,
      }),
    ).offeredSharingSkills[0]?.skillLevel?.name,
    custom.name,
  );
  assert.equal(
    ownerSchema.safeParse({ ...own, currentLevel: "B2" }).success,
    false,
  );
});

test("level read cancellation, server failures and account changes preserve their error boundary", async () => {
  const offline = harness(() => ({
    status: 503,
    payload: { success: false, message: "SERVICE_UNAVAILABLE" },
  }));
  await assert.rejects(
    offline.api.levels(ids.skill),
    (error) => error instanceof AppError && error.status === 503,
  );
  const cancelled = new AbortController();
  cancelled.abort();
  await assert.rejects(
    offline.api.levels(ids.skill, cancelled.signal),
    AppError,
  );
  assert.equal(offline.calls.length, 1);
  let resolve!: (value: { payload: unknown }) => void;
  const late = harness(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const request = late.api.levels(ids.skill);
  await new Promise((done) => setImmediate(done));
  late.switchAccount();
  resolve({ payload: success([custom]) });
  await assert.rejects(
    request,
    (error) => error instanceof AppError && error.kind === "session",
  );
});
