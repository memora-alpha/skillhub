import test from "node:test";
import assert from "node:assert/strict";
import { AppError } from "../src/lib/http/errors";
import { findPublicSkill } from "../src/features/skills/utils/find-public-skill";
import { QueryClient } from "@tanstack/react-query";
import { recordSkillQueries } from "../src/features/skills/utils/record-skill-queries";
import {
  ownSkillSchema,
  publicSkillSchema,
} from "../src/features/skills/api/skill-contracts";
import { ids, ownSkill, harness, paginated } from "./skills-fixtures";

test("public detail walks public pages for the target profile and strips private owner/evidence data", async () => {
  const h = harness((_config, index) => ({
    payload:
      index === 1
        ? paginated([], "next-public-page")
        : paginated([
            {
              ...ownSkill,
              files: [{ url: "private" }],
              reviewerId: "private",
              rejectReason: "private",
            },
          ]),
  }));
  const skill = await findPublicSkill(ids.sharing, (cursor, signal) =>
    h.api.publicSkills(ids.other, cursor, signal),
  );
  assert.equal(skill?.description, ownSkill.description);
  assert.equal(skill?.experienceYears, "0.0");
  assert.deepEqual(
    Object.keys(skill!).sort(),
    [
      "id",
      "skill",
      "level",
      "description",
      "experienceYears",
      "verificationStatus",
    ].sort(),
  );
  assert.equal(h.calls.length, 2);
  assert.ok(
    h.calls.every((call) =>
      call.url?.includes(`/profiles/${ids.other}/skills?`),
    ),
  );
  assert.ok(h.calls[1]?.url?.includes("cursor=next-public-page"));
});

test("a skill absent from public pages is unavailable without reading owner or evidence endpoints", async () => {
  const h = harness(() => ({ payload: paginated([]) }));
  assert.equal(
    await findPublicSkill(ids.sharing, (cursor) =>
      h.api.publicSkills(ids.user, cursor),
    ),
    null,
  );
  assert.equal(h.calls.length, 1);
  assert.ok(h.calls[0]?.url?.includes(`/profiles/${ids.user}/skills?`));
});

test("public-detail errors propagate instead of substituting owner data", async () => {
  const h = harness(() => ({
    status: 503,
    payload: { success: false, message: "SERVICE_UNAVAILABLE" },
  }));
  await assert.rejects(
    findPublicSkill(ids.sharing, (cursor) =>
      h.api.publicSkills(ids.user, cursor),
    ),
    (error) => error instanceof AppError && error.status === 503,
  );
  assert.equal(h.calls.length, 1);
});

test("public detail rejects a repeated pagination cursor and stops after cancellation", async () => {
  const h = harness(() => ({ payload: paginated([], "same") }));
  await assert.rejects(
    findPublicSkill(ids.sharing, (cursor) =>
      h.api.publicSkills(ids.user, cursor),
    ),
    (error) => error instanceof AppError && error.kind === "protocol",
  );
  assert.equal(h.calls.length, 2);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    findPublicSkill(
      ids.sharing,
      (cursor) => h.api.publicSkills(ids.user, cursor),
      controller.signal,
    ),
  );
  assert.equal(h.calls.length, 2);
});

test("confirmed hide clears only the matching session's public detail and never fills it with owner metadata", () => {
  const client = new QueryClient();
  const scope = ["skills", 1, ids.user];
  const key = [...scope, "public-detail", ids.user, ids.sharing];
  const otherKey = [
    "skills",
    2,
    ids.other,
    "public-detail",
    ids.user,
    ids.sharing,
  ];
  const publicSkill = publicSkillSchema.parse(ownSkill);
  try {
    client.setQueryData(key, publicSkill);
    client.setQueryData(otherKey, publicSkill);
    recordSkillQueries(
      client,
      scope,
      ownSkillSchema.parse({ ...ownSkill, isVisible: false, version: 2 }),
    );
    assert.equal(client.getQueryData(key), null);
    assert.deepEqual(client.getQueryData(otherKey), publicSkill);
    recordSkillQueries(
      client,
      scope,
      ownSkillSchema.parse({ ...ownSkill, isVisible: true, version: 3 }),
    );
    assert.equal(client.getQueryData(key), null);
  } finally {
    client.clear();
  }
});
