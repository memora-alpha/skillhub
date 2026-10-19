import assert from "node:assert/strict";
import { test } from "node:test";
import { validateAuditInput } from "../dist/modules/audit/domain/audit-action.catalog.js";
import { validateReason } from "../dist/modules/audit/domain/reason.policy.js";
import { auditActorFromActor } from "../dist/modules/audit/application/audit.types.js";

const userId = "11111111-1111-4111-8111-111111111111";
const requestId = "22222222-2222-4222-8222-222222222222";
const correlationId = "33333333-3333-4333-8333-333333333333";

const configuration = {
  actor: { kind: "HUMAN", userId, roles: ["ADMIN"] },
  action: "SYSTEM_CONFIGURATION_UPDATE",
  target: { type: "SYSTEM_CONFIGURATION", id: "storage.downloadTtlSeconds" },
  before: { value: 120, version: 1 },
  after: { value: 60, version: 2 },
  reason: "  Reduce exposure window  ",
  context: { requestId, correlationId },
};

test("reason bounds count code points after trim and reject blank text", () => {
  assert.equal(validateReason("  ok  ", { min: 1, max: 2000 }), "ok");
  assert.equal(validateReason("😀", { min: 1, max: 1 }), "😀");
  for (const reason of ["", " \n ", "x".repeat(2001)]) {
    assert.throws(() => validateReason(reason, { min: 1, max: 2000 }));
  }
});

test("config audit accepts allowlisted projection and normalizes reason", () => {
  const result = validateAuditInput(configuration);
  assert.equal(result.reason, "Reduce exposure window");
  assert.deepEqual(result.before, { value: 120, version: 1 });
});

test("audit rejects unknown action, actor spoofing fields and invalid contexts", () => {
  for (const input of [
    { ...configuration, action: "UNKNOWN" },
    { ...configuration, actor: { kind: "HUMAN", roles: ["ADMIN"] } },
    { ...configuration, actor: { ...configuration.actor, name: "SYSTEM" } },
    { ...configuration, actor: { kind: "SYSTEM", name: "worker", userId } },
    {
      ...configuration,
      context: { ...configuration.context, requestId: "not-uuid" },
    },
    { ...configuration, clientNow: "2026-10-05T00:00:00Z" },
  ]) {
    assert.throws(() => validateAuditInput(input));
  }
  assert.equal(
    validateAuditInput({
      ...configuration,
      actor: { kind: "SYSTEM", name: "policy-seed" },
    }).actor.kind,
    "SYSTEM",
  );
});

test("HTTP actor mapping copies only verified identity and role snapshot", () => {
  const verifiedActor = {
    userId,
    roles: ["ADMIN"],
    accountStatus: "ACTIVE",
    permissions: new Set(["credit:adjust"]),
    blockedPermissions: new Set(),
    passwordHash: "never audit this",
  };
  const result = auditActorFromActor(verifiedActor);
  assert.deepEqual(result, { kind: "HUMAN", userId, roles: ["ADMIN"] });
  verifiedActor.roles.push("STAFF");
  assert.deepEqual(result.roles, ["ADMIN"]);
});

test("verification rejection uses its 10-500 character reason bound", () => {
  const rejection = {
    ...configuration,
    action: "VERIFY_SKILL_REJECT",
    target: { type: "SKILL_VERIFICATION", id: userId },
    before: { status: "PENDING" },
    after: { status: "REJECTED" },
  };
  assert.throws(() =>
    validateAuditInput({ ...rejection, reason: "x".repeat(9) }),
  );
  assert.doesNotThrow(() =>
    validateAuditInput({ ...rejection, reason: "x".repeat(10) }),
  );
  assert.doesNotThrow(() =>
    validateAuditInput({ ...rejection, reason: "x".repeat(500) }),
  );
  assert.throws(() =>
    validateAuditInput({ ...rejection, reason: "x".repeat(501) }),
  );
});

test("learning request moderation projections require a positive request version", () => {
  const moderation = {
    ...configuration,
    action: "LEARNING_REQUEST_MODERATE",
    target: { type: "LEARNING_REQUEST", id: requestId },
    before: { status: "PENDING", requestVersion: 3 },
    after: { status: "REJECTED", requestVersion: 4 },
  };
  assert.deepEqual(validateAuditInput(moderation).after, {
    status: "REJECTED",
    requestVersion: 4,
  });
  for (const invalid of [
    { ...moderation, before: { status: "OPEN", requestVersion: 3 } },
    { ...moderation, after: { status: "REJECTED", requestVersion: 0 } },
    { ...moderation, after: { status: "APPROVED", requestVersion: 1.5 } },
    { ...moderation, after: { status: "REMOVED", requestVersion: 4 } },
  ]) {
    assert.throws(() => validateAuditInput(invalid));
  }
});

test("secret and unknown snapshot fields are rejected recursively", () => {
  for (const badValue of [
    { returned: 9600, fee: 400, token: "secret" },
    { returned: 9600, fee: { cvv: "123" } },
  ]) {
    assert.throws(() =>
      validateAuditInput({
        ...configuration,
        target: {
          type: "SYSTEM_CONFIGURATION",
          id: "credit.pathSettlementBps",
        },
        after: { value: badValue, version: 2 },
      }),
    );
  }
  for (const secretKey of [
    "passwordHash",
    "otp",
    "token",
    "cvv",
    "signedUrl",
  ]) {
    assert.throws(() =>
      validateAuditInput({
        ...configuration,
        after: { ...configuration.after, [secretKey]: "secret" },
      }),
    );
  }
  assert.throws(() =>
    validateAuditInput({
      ...configuration,
      action: "USER_LOCK",
      target: { type: "USER", id: userId },
      before: { status: "ACTIVE", passwordHash: "secret" },
      after: { status: "LOCKED" },
    }),
  );
  assert.throws(() =>
    validateAuditInput({
      ...configuration,
      action: "CREDIT_ADJUST",
      target: { type: "CREDIT_WALLET", id: userId },
      before: { balanceBefore: "100", signedUrl: "secret" },
      after: { balanceAfter: "101" },
    }),
  );
});
