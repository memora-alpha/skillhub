import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  resolveStaffPermissions,
  assertIndependentSkillReviewer,
} from "../../dist/modules/users/domain/staff-permissions.js";
import { LearningRequestAccessService } from "../../dist/modules/learning-requests/application/services/learning-request-access.service.js";
import { StaffPermissionService } from "../../dist/modules/users/application/services/staff-permission.service.js";
import { SkillActorService } from "../../dist/modules/users/application/services/skill-actor.service.js";

test("a Staff submission still requires Admin after the owner is demoted to USER", async () => {
  const service = new SkillActorService({}, {});
  const tx = {
    user: {
      findUniqueOrThrow: async () => ({ roleIdRecord: { code: "USER" } }),
    },
  };
  await assert.rejects(
    service.assertSkillReviewer(
      tx,
      { userId: "reviewer", roles: ["STAFF"] },
      "owner",
      "STAFF",
    ),
    /STAFF_SKILL_REQUIRES_ADMIN/,
  );
  await service.assertSkillReviewer(
    tx,
    { userId: "reviewer", roles: ["ADMIN"] },
    "owner",
    "STAFF",
  );
});

test("Staff inherits participation; deny/reset are distinct and cannot grant financial privileges", () => {
  assert.deepEqual(
    resolveStaffPermissions(
      ["report:moderate"],
      ["proposal:create"],
      [
        { code: "report:moderate", effect: "DENY" },
        { code: "credit:adjust", effect: "GRANT" },
        { code: "proposal:create", effect: "DENY" },
      ],
    ),
    ["proposal:create"],
  );
  assert.deepEqual(
    resolveStaffPermissions(["report:moderate"], ["proposal:create"], []),
    ["proposal:create", "report:moderate"],
  );
});

test("only an independent Admin can review Staff skills; USER submissions keep operational review", () => {
  for (const roles of [["STAFF"], ["ADMIN"]])
    assert.throws(
      () =>
        assertIndependentSkillReviewer(
          { userId: "owner", roles },
          "owner",
          roles[0],
        ),
      /SKILL_SELF_REVIEW_FORBIDDEN/,
    );
  assert.throws(
    () =>
      assertIndependentSkillReviewer(
        { userId: "other", roles: ["STAFF"] },
        "owner",
        "STAFF",
      ),
    /STAFF_SKILL_REQUIRES_ADMIN/,
  );
  assertIndependentSkillReviewer(
    { userId: "other", roles: ["ADMIN"] },
    "owner",
    "STAFF",
  );
  assertIndependentSkillReviewer(
    { userId: "other", roles: ["STAFF"] },
    "owner",
    "USER",
  );
});

test("Staff participation still requires live permission; ADMIN role does not imply participant permission", async () => {
  let live = { roles: ["STAFF"], permissions: ["learning-request:create"] };
  const access = new LearningRequestAccessService({
    assertLive: async () => live,
  });
  assert.equal(
    await access.assertUserAction({}, {}, "learning-request:create"),
    live,
  );
  live = { roles: ["STAFF"], permissions: [] };
  await assert.rejects(
    access.assertUserAction({}, {}, "learning-request:create"),
  );
  live = { roles: ["ADMIN"], permissions: ["learning-request:create"] };
  await assert.rejects(
    access.assertUserAction({}, {}, "learning-request:create"),
  );
});

test("permission change verifies live Admin and current target version before consuming reauth or writing", async () => {
  let isAdmin = false,
    wrote = 0,
    proof = 0;
  const tx = { $queryRaw: async () => [] };
  const service = new StaffPermissionService(
    { $transaction: async (work) => work(tx) },
    {
      assertLive: async () => ({
        userId: "admin",
        roles: isAdmin ? ["ADMIN"] : ["STAFF"],
        permissions: ["staff-permissions:manage"],
      }),
    },
    {
      consumeReauth: async () => {
        proof++;
      },
    },
    {},
    {
      target: async () => ({
        roleIdRecord: { code: "STAFF" },
        staffPermissionVersion: 2,
      }),
      change: async () => {
        wrote++;
      },
      list: async () => [],
    },
    {},
  );
  const input = {
    effect: "DENY",
    expectedVersion: 1,
    reason: "Operational reassignment",
    reauthToken: "proof",
  };
  await assert.rejects(
    service.change({ userId: "admin" }, "staff", "report:moderate", input),
    /STAFF_PERMISSION_MANAGEMENT_REQUIRED/,
  );
  isAdmin = true;
  await assert.rejects(
    service.change({ userId: "admin" }, "staff", "report:moderate", input),
    /STALE_STAFF_PERMISSION_VERSION/,
  );
  await assert.rejects(
    async () =>
      service.change({ userId: "admin" }, "staff", "credit:adjust", input),
    /PERMISSION_NOT_DELEGABLE/,
  );
  assert.equal(wrote, 0);
  assert.equal(proof, 0);
});
