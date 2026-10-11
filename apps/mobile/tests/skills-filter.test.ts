import test from "node:test";
import assert from "node:assert/strict";
import {
  filteredSkillPage,
  skillListPlaceholder,
} from "../src/features/skills/utils/skill-filter";
import {
  ownSkillSchema,
  verificationSchema,
} from "../src/features/skills/api/skill-contracts";
import { ownSkill, batch } from "./skills-fixtures";
import type { OwnSkill, SkillBadge } from "../src/features/skills/types/skills";

const row = (status: SkillBadge) =>
  ownSkillSchema.parse({ ...ownSkill, verificationStatus: status });
const page = (data: OwnSkill[], nextCursor: string | null = null) => ({
  data,
  pagination: { limit: 20, hasMore: nextCursor !== null, nextCursor },
});
test("verified filter traverses empty matching pages before reporting empty", async () => {
  const cursors: (string | undefined)[] = [];
  const result = await filteredSkillPage(async (cursor) => {
    cursors.push(cursor);
    return cursor ? page([row("VERIFIED")]) : page([row("UNVERIFIED")], "next");
  }, "VERIFIED");
  assert.deepEqual(cursors, [undefined, "next"]);
  assert.equal(result.data[0]?.verificationStatus, "VERIFIED");
  assert.equal(result.pagination.hasMore, false);
});
test("not verified includes pending and rejected while excluding verified", async () => {
  const result = await filteredSkillPage(
    async () =>
      page([
        row("VERIFIED"),
        row("UNVERIFIED"),
        row("PENDING"),
        row("REJECTED"),
      ]),
    "UNVERIFIED",
  );
  assert.deepEqual(
    result.data.map((skill) => skill.verificationStatus),
    ["UNVERIFIED", "PENDING", "REJECTED"],
  );
});
test("filtered page retains server cursor to continue matching later pages", async () => {
  const result = await filteredSkillPage(
    async () => page([row("VERIFIED")], "later"),
    "VERIFIED",
  );
  assert.equal(result.pagination.nextCursor, "later");
  assert.equal(result.pagination.hasMore, true);
});
test("filter rejects repeated cursor rather than looping forever", async () => {
  await assert.rejects(
    filteredSkillPage(
      async () => page([row("UNVERIFIED")], "same"),
      "VERIFIED",
      "same",
    ),
  );
});
test("later page failure propagates without claiming empty filtered results", async () => {
  const failure = new Error("offline");
  await assert.rejects(
    filteredSkillPage(async (cursor) => {
      if (cursor) throw failure;
      return page([row("UNVERIFIED")], "next");
    }, "VERIFIED"),
    (error) => error === failure,
  );
});

test("filter placeholder never resurrects deleted/archived skills or mutates cached pagination", () => {
  const active = row("UNVERIFIED");
  const deleted = { ...active, id: "deleted" };
  const archived = {
    ...active,
    id: "archived",
    archivedAt: new Date().toISOString(),
  };
  const data = {
    pages: [page([active, deleted, archived], "later")],
    pageParams: [undefined],
  };
  const submitted = new Map([[active.id, verificationSchema.parse(batch)]]);
  const result = skillListPlaceholder(
    data,
    "PENDING",
    new Set([deleted.id]),
    submitted,
  )!;
  assert.deepEqual(
    result.pages[0]?.data.map((skill) => skill.id),
    [active.id],
  );
  assert.equal(result.pages[0]?.data[0]?.verificationStatus, "PENDING");
  assert.deepEqual(result.pages[0]?.pagination, data.pages[0]?.pagination);
  assert.deepEqual(result.pageParams, data.pageParams);
  assert.equal(data.pages[0]?.data.length, 3);
  assert.equal(active.verificationStatus, "UNVERIFIED");
  assert.equal(
    skillListPlaceholder(undefined, "ALL", new Set(), new Map()),
    undefined,
  );
});
