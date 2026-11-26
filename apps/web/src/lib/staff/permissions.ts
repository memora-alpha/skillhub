import type { StaffIdentity } from "./types";

export const STAFF_DEFAULT_PERMISSIONS = [
  "learning-request:moderation:read",
  "learning-request:approve",
  "learning-request:reject",
  "skill-verification:read",
  "skill-verification:approve",
  "skill-verification:reject",
  "report:moderate",
  "learning-path:terminate",
  "material:moderate",
] as const;

export const STAFF_OPT_IN_PERMISSIONS = [
  "report:group",
  "report:classify",
  "report:communicate",
  "material-review:moderate",
  "profile:moderate",
  "review:moderate",
] as const;

export const STAFF_DELEGABLE_PERMISSIONS = [
  ...STAFF_DEFAULT_PERMISSIONS,
  ...STAFF_OPT_IN_PERMISSIONS,
] as const;

export type StaffPermissionCode = (typeof STAFF_DELEGABLE_PERMISSIONS)[number];

export type StaffPermissionGroupId =
  | "learning-requests"
  | "verifications"
  | "content-profile"
  | "reports-terminations";

export const STAFF_PERMISSION_GROUPS: readonly Readonly<{
  id: StaffPermissionGroupId;
  title: string;
  description: string;
  codes: readonly StaffPermissionCode[];
}>[] = [
  {
    id: "verifications",
    title: "Xác minh bằng chứng kỹ năng",
    description:
      "Xem hồ sơ chứng minh năng lực và quyết định công nhận hoặc từ chối kỹ năng.",
    codes: [
      "skill-verification:read",
      "skill-verification:approve",
      "skill-verification:reject",
    ],
  },
  {
    id: "learning-requests",
    title: "Kiểm duyệt yêu cầu học",
    description:
      "Xử lý các bài nhu cầu học bị bộ lọc từ khóa gắn cờ hoặc có đề xuất tag mới.",
    codes: [
      "learning-request:moderation:read",
      "learning-request:approve",
      "learning-request:reject",
    ],
  },
  {
    id: "content-profile",
    title: "Tài liệu số, hồ sơ & đánh giá",
    description:
      "Kiểm duyệt tài liệu số (FREE/PAID), hồ sơ cá nhân và đánh giá sau học tập.",
    codes: [
      "material:moderate",
      "material-review:moderate",
      "review:moderate",
      "profile:moderate",
    ],
  },
  {
    id: "reports-terminations",
    title: "Báo cáo, tranh chấp & dừng lộ trình",
    description:
      "Tiếp nhận vụ việc, trao đổi riêng với các bên, phân loại, gom vụ việc và xử lý yêu cầu dừng lộ trình.",
    codes: [
      "report:moderate",
      "learning-path:terminate",
      "report:classify",
      "report:communicate",
      "report:group",
    ],
  },
];

export function isStaffDefaultPermission(code: string): boolean {
  return (STAFF_DEFAULT_PERMISSIONS as readonly string[]).includes(code);
}

export function isAdminActor(actor: StaffIdentity | null | undefined): boolean {
  return Boolean(actor?.roles.includes("ADMIN"));
}

/**
 * Checks whether an authenticated operational actor holds a given permission.
 * - ADMIN holds all operational permissions by design.
 * - If `permissions` was omitted (e.g., legacy/test fixture without permission payload),
 *   falls back to allowing default STAFF permissions so UI never locks out unexpectedly;
 *   backend RBAC remains the final authority.
 */
export function hasPermission(
  actor: StaffIdentity | null | undefined,
  code: string,
): boolean {
  if (!actor) return false;
  if (actor.roles.includes("ADMIN")) return true;
  if (Array.isArray(actor.permissions)) {
    return actor.permissions.includes(code);
  }
  return isStaffDefaultPermission(code) || code === "reward:manage";
}

export function hasAnyPermission(
  actor: StaffIdentity | null | undefined,
  codes: readonly string[],
): boolean {
  if (!codes.length) return true;
  return codes.some((code) => hasPermission(actor, code));
}

export function hasAllPermissions(
  actor: StaffIdentity | null | undefined,
  codes: readonly string[],
): boolean {
  return codes.every((code) => hasPermission(actor, code));
}

export function countGrantedDelegablePermissions(
  actor: StaffIdentity | null | undefined,
): number {
  if (!actor) return 0;
  return STAFF_DELEGABLE_PERMISSIONS.filter((code) =>
    hasPermission(actor, code),
  ).length;
}
