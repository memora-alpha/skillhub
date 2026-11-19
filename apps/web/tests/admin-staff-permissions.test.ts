import assert from "node:assert/strict";
import { test } from "node:test";
import { staffIdentity, upstreamPath } from "../src/lib/staff/policy";
import {
  countGrantedDelegablePermissions,
  hasPermission,
  STAFF_DEFAULT_PERMISSIONS,
} from "../src/lib/staff/permissions";
import { visibleStaffNavItems } from "../src/lib/staff/staff-navigation";
import { auditTargetHref } from "../src/lib/staff/audit-presentation";

const idA = "11111111-1111-4111-8111-111111111111";
const idB = "22222222-2222-4222-8222-222222222222";

test("staffIdentity forwards effective permissions from /v1/me", () => {
  const identity = staffIdentity({
    userId: idA,
    accountStatus: "ACTIVE",
    emailVerified: true,
    roles: ["STAFF"],
    permissions: ["report:moderate", "learning-path:terminate"],
    profile: { fullName: "Nhân viên A" },
  });
  assert.deepEqual(identity, {
    userId: idA,
    roles: ["STAFF"],
    permissions: ["report:moderate", "learning-path:terminate"],
    fullName: "Nhân viên A",
  });
});

test("Staff portal proxies termination execute & material history while keeping evidence revoke Admin-only", () => {
  assert.equal(
    upstreamPath(
      "POST",
      `learning-paths/${idA}/termination-requests/${idB}/execute`,
      "staff",
    ),
    `learning-paths/${idA}/termination-requests/${idB}/execute`,
  );
  assert.equal(
    upstreamPath("GET", `materials/${idA}/moderation-history`, "staff"),
    `staff/materials/${idA}/moderation-history`,
  );
  assert.equal(
    upstreamPath(
      "POST",
      `verifications/${idA}/evidence/${idB}/revoke`,
      "staff",
    ),
    null,
  );
  assert.equal(
    upstreamPath(
      "POST",
      `verifications/${idA}/evidence/${idB}/revoke`,
      "admin",
    ),
    `staff/verifications/${idA}/evidence/${idB}/revoke`,
  );
});

test("Staff navigation and permission helpers respect granted permissions and Admin full access", () => {
  const defaultStaff = {
    userId: idA,
    fullName: "Staff mặc định",
    roles: ["STAFF"],
    permissions: [...STAFF_DEFAULT_PERMISSIONS],
  };
  assert.equal(countGrantedDelegablePermissions(defaultStaff), 9);
  assert.equal(hasPermission(defaultStaff, "learning-path:terminate"), true);
  assert.equal(hasPermission(defaultStaff, "profile:moderate"), false);
  const defaultNavIds = visibleStaffNavItems(defaultStaff).map((i) => i.id);
  assert.equal(defaultNavIds.includes("evidence"), true);
  assert.equal(defaultNavIds.includes("learning-changes"), true);
  assert.equal(defaultNavIds.includes("profile-moderation"), false);

  const extendedStaff = {
    ...defaultStaff,
    permissions: [...STAFF_DEFAULT_PERMISSIONS, "profile:moderate"],
  };
  assert.equal(
    visibleStaffNavItems(extendedStaff).some(
      (i) => i.id === "profile-moderation",
    ),
    true,
  );

  const admin = {
    userId: idB,
    fullName: "Admin",
    roles: ["ADMIN"],
    permissions: [],
  };
  assert.equal(hasPermission(admin, "report:group"), true);
  assert.equal(countGrantedDelegablePermissions(admin), 15);
});

test("auditTargetHref resolves deep links for operational Admin screens", () => {
  assert.equal(auditTargetHref("REPORT_CASE", idA), `/admin/disputes/${idA}`);
  assert.equal(
    auditTargetHref("REPORT_INCIDENT", idA),
    `/admin/disputes?incidentId=${idA}`,
  );
  assert.equal(
    auditTargetHref("LEARNING_PATH", idA),
    `/admin/learning-paths/${idA}`,
  );
  assert.equal(
    auditTargetHref("SKILL_VERIFICATION", idA),
    `/admin/evidence?verificationId=${idA}`,
  );
  assert.equal(
    auditTargetHref("TAG_REQUEST", idA),
    `/admin/tag-requests?requestId=${idA}`,
  );
  assert.equal(
    auditTargetHref("PAYMENT", idA),
    `/admin/credits?tab=payments&paymentId=${idA}`,
  );
  assert.equal(
    auditTargetHref("CREDIT_TRANSACTION", idA),
    `/admin/credits?tab=ledger&transactionId=${idA}`,
  );
  assert.equal(auditTargetHref("PAYMENT", "not-a-uuid"), null);
});
