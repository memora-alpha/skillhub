import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const apiRoot = fileURLToPath(new URL("../..", import.meta.url));
execFileSync(process.execPath, ["scripts/write-identity-schema.mjs"], {
  cwd: apiRoot,
});
const schema = readFileSync(join(apiRoot, "prisma/identity.prisma"), "utf8");
const includesModel = (name) => schema.includes(`model ${name} {`);
const includesEnum = (name) => schema.includes(`enum ${name} {`);
const modelBlock = (name) =>
  schema.match(new RegExp(`^model ${name} \\{([\\s\\S]*?)^\\}`, "m"))?.[1] ??
  "";

test("deployment snapshot contains the approved Learning Request lifecycle fields", () => {
  assert.ok(includesModel("LearningRequest"), "missing model LearningRequest");
  for (const field of [
    "moderationStatus",
    "moderationRejectReason",
    "flaggedCategories",
    "moderationRuleSetVersion",
    "moderationReviewedVersion",
    "moderatedBy",
    "moderatedAt",
    "expiryMode",
    "requestedExpiresAt",
    "publishedAt",
    "version",
    "verifiedTeacherOnly",
  ]) {
    assert.ok(
      new RegExp(`^\\s+${field}\\s+`, "m").test(modelBlock("LearningRequest")),
      `missing LearningRequest.${field}`,
    );
  }
  for (const field of ["expectedDurationMinutes", "budgetCredit"]) {
    assert.ok(
      !new RegExp(`^\\s+${field}\\s+`, "m").test(modelBlock("LearningRequest")),
      `unexpected legacy field LearningRequest.${field}`,
    );
  }
});

test("request child models and notification remain in deployment scope", () => {
  for (const model of ["LearningRequest", "RequestTag", "Notification"]) {
    assert.ok(includesModel(model), `missing model ${model}`);
  }
  assert.ok(includesEnum("RequestModerationStatus"));
  assert.ok(includesEnum("RequestExpiryMode"));
  assert.ok(!includesModel("RequestPreferredSlot"));
});

test("ERD v3 storage names and optional Request relationships are preserved", () => {
  const request = modelBlock("LearningRequest");
  assert.match(
    request,
    /preferredSlots\s+Json\s+@default\("\[\]"\)\s+@map\("preferred_slots"\)/,
  );
  assert.match(
    request,
    /verifiedTeacherOnly\s+Boolean\s+@default\(false\)\s+@map\("verified_teacher_only"\)/,
  );
  for (const [field, column] of [
    ["version", "content_version"],
    ["moderationRejectReason", "reject_reason"],
    ["moderatedByUserId", "reviewed_by_user_id"],
    ["moderatedAt", "reviewed_at"],
  ]) {
    assert.match(
      request,
      new RegExp(`^\\s+${field}\\s+[^\\n]*@map\\("${column}"\\)`, "m"),
    );
  }
  assert.match(request, /flaggedCategories\s+Json\?\s+@map\("flagged_rules"\)/);
  const full = readFileSync(join(apiRoot, "prisma/schema.prisma"), "utf8");
  for (const model of ["Proposal", "Conversation"]) {
    const block = full.match(
      new RegExp(`^model ${model} \\{([\\s\\S]*?)^\\}`, "m"),
    )[1];
    assert.match(block, /requestId\s+String\?\s+@map\("request_id"\)/);
    assert.match(block, /request\s+LearningRequest\?/);
  }
});

test("snapshot removes inverse relations owned by modules outside deployment scope", () => {
  for (const model of [
    "Proposal",
    "Conversation",
    "ScheduleProposal",
    "Session",
    "SharingSkill",
  ]) {
    assert.ok(!includesModel(model), `unexpected model ${model}`);
  }
  for (const relation of [
    "ProposalAsRequest",
    "ConversationAsRequest",
    "SessionAsSkill",
    "SharingSkillAsSkill",
  ]) {
    assert.ok(
      !new RegExp(`^\\s+${relation}\\s+`, "m").test(schema),
      `unexpected relation ${relation}`,
    );
  }
  assert.ok(includesModel("Skill"));
  assert.ok(includesModel("SkillCategory"));
});

test("identity and foundation models remain in the scoped snapshot", () => {
  for (const model of [
    "User",
    "AuditLog",
    "OutboxEvent",
    "SystemConfiguration",
  ]) {
    assert.ok(includesModel(model), `missing model ${model}`);
  }
});
