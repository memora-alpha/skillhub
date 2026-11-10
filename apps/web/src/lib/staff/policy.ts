const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const routes: [string, RegExp, (path: string) => string][] = [
  ["GET", new RegExp(`^profiles/${uuid}(/skills|/reviews)?$`, "i"), (p) => p],
  ["GET", /^reviews$/, (p) => `staff/${p}`],
  [
    "POST",
    new RegExp(`^reviews/${uuid}/moderation$`, "i"),
    (p) => `staff/${p}`,
  ],
  [
    "GET",
    new RegExp(`^users/${uuid}/profile-moderation$`, "i"),
    (p) => `staff/${p}`,
  ],
  [
    "POST",
    new RegExp(`^users/${uuid}/profile-moderation$`, "i"),
    (p) => `staff/${p}`,
  ],
  ["GET", /^reports\/support\/queue$/, (p) => p],
  ["GET", new RegExp(`^reports/support/incidents/${uuid}$`, "i"), (p) => p],
  ["POST", /^reports\/support\/incidents$/, (p) => p],
  [
    "POST",
    new RegExp(`^reports/support/incidents/${uuid}/(severity|decision)$`, "i"),
    (p) => p,
  ],
  [
    "POST",
    new RegExp(`^reports/support/cases/${uuid}/severity$`, "i"),
    (p) => p,
  ],
  [
    "GET",
    new RegExp(
      `^reports/support/cases/${uuid}/parties/${uuid}/(messages|evidence)$`,
      "i",
    ),
    (p) => p,
  ],
  [
    "POST",
    new RegExp(`^reports/support/cases/${uuid}/parties/${uuid}/messages$`, "i"),
    (p) => p,
  ],
  [
    "GET",
    new RegExp(
      `^reports/support/cases/${uuid}/parties/${uuid}/evidence/${uuid}/download$`,
      "i",
    ),
    (p) => p,
  ],
  [
    "GET",
    new RegExp(
      `^reports/support/cases/${uuid}/parties/${uuid}/evidence/${uuid}/content$`,
      "i",
    ),
    (p) => p.replace(/content$/, "download"),
  ],
  [
    "GET",
    new RegExp(`^reputation/users/${uuid}/restriction-reviews$`, "i"),
    (p) => p,
  ],
  [
    "POST",
    new RegExp(`^reputation/restrictions/${uuid}/review$`, "i"),
    (p) => p,
  ],
  ["GET", /^learning-changes\/review-queue$/, (p) => p],
  [
    "GET",
    new RegExp(
      `^learning-paths/${uuid}/termination-requests/${uuid}/review$`,
      "i",
    ),
    (p) => p,
  ],
  [
    "POST",
    new RegExp(
      `^learning-paths/${uuid}/termination-requests/${uuid}/reject$`,
      "i",
    ),
    (p) => p,
  ],
  ["GET", /^materials$/, () => "staff/materials"],
  ["GET", new RegExp(`^materials/${uuid}/download$`, "i"), (p) => p],
  [
    "GET",
    new RegExp(`^materials/${uuid}/content$`, "i"),
    (p) => p.replace(/content$/, "download"),
  ],
  [
    "POST",
    new RegExp(`^materials/${uuid}/(approve|reject|hide|unhide)$`, "i"),
    (p) => `staff/${p}`,
  ],
  ["GET", /^wallet$/, () => "me/wallet"],
  ["GET", /^wallet\/transactions$/, () => "me/wallet/transactions"],
  ["GET", new RegExp(`^wallet/transactions/${uuid}$`, "i"), (p) => `me/${p}`],
  ["GET", /^reputation$/, () => "reputation/me"],
  ["GET", /^verifications$/, () => "staff/verifications"],
  ["GET", new RegExp(`^verifications/${uuid}$`, "i"), (p) => `staff/${p}`],
  [
    "POST",
    new RegExp(`^verifications/${uuid}/(approve|reject)$`, "i"),
    (p) => `staff/${p}`,
  ],
  [
    "POST",
    new RegExp(`^verifications/${uuid}/evidence/${uuid}/revoke$`, "i"),
    (p) => `staff/${p}`,
  ],
  [
    "GET",
    new RegExp(`^verifications/${uuid}/evidence/${uuid}/download$`, "i"),
    (p) => `staff/${p}`,
  ],
  [
    "GET",
    new RegExp(`^verifications/${uuid}/evidence/${uuid}/content$`, "i"),
    (p) => `staff/${p.replace(/content$/, "download")}`,
  ],
  ["GET", /^learning-requests$/, () => "staff/learning-requests/moderation"],
  [
    "POST",
    new RegExp(`^learning-requests/${uuid}/(approve|reject)$`, "i"),
    (p) => `staff/${p}`,
  ],
  ["GET", /^reports$/, () => "reports/staff/queue"],
  [
    "GET",
    new RegExp(`^reports/${uuid}$`, "i"),
    (p) => p.replace("reports/", "reports/staff/"),
  ],
  [
    "POST",
    new RegExp(`^reports/${uuid}/(claim|need-more-info|resolve|reject)$`, "i"),
    (p) => p.replace("reports/", "reports/staff/"),
  ],
  [
    "GET",
    new RegExp(`^reports/evidence/${uuid}/download$`, "i"),
    (p) => p.replace("reports/", "reports/staff/"),
  ],
  [
    "GET",
    new RegExp(`^reports/evidence/${uuid}/content$`, "i"),
    (p) =>
      p.replace("reports/", "reports/staff/").replace(/content$/, "download"),
  ],
  ["GET", /^notifications$/, (p) => p],
  ["PATCH", new RegExp(`^notifications/${uuid}/read$`, "i"), (p) => p],
];
const adminRoutes: [string, RegExp, (path: string) => string][] = [
  ["GET", /^staff-permissions\/catalog$/, (p) => `admin/${p}`],
  ["GET", new RegExp(`^staff-permissions/${uuid}$`, "i"), (p) => `admin/${p}`],
  [
    "PUT",
    new RegExp(`^staff-permissions/${uuid}/[a-z][a-z0-9:-]+$`, "i"),
    (p) => `admin/${p}`,
  ],
  ["POST", new RegExp(`^reputation/events/${uuid}/reverse$`, "i"), (p) => p],
  ["GET", /^credit\/transactions$/, (p) => `admin/${p}`],
  [
    "GET",
    new RegExp(`^credit/(transactions|operations)/${uuid}$`, "i"),
    (p) => `admin/${p}`,
  ],
  ["GET", new RegExp(`^users/${uuid}/wallet$`, "i"), (p) => `admin/${p}`],
  ["GET", /^payments$/, (p) => `admin/${p}`],
  [
    "GET",
    new RegExp(`^payments/${uuid}(/reconciliation)?$`, "i"),
    (p) => `admin/${p}`,
  ],
  ["GET", /^fee-policies$/, (p) => `admin/${p}`],
  ["POST", /^fee-policies\/material$/, (p) => `admin/${p}`],
  [
    "POST",
    new RegExp(`^fee-policies/${uuid}/approve$`, "i"),
    (p) => `admin/${p}`,
  ],
  ["GET", /^fee-revenue$/, (p) => `admin/${p}`],
  [
    "POST",
    new RegExp(
      `^learning-paths/${uuid}/termination-requests/${uuid}/execute$`,
      "i",
    ),
    (p) => p,
  ],
  ["GET", /^achievements$/, () => "me/achievements"],
  [
    "PATCH",
    /^achievements\/selected-title$/,
    () => "me/achievements/selected-title",
  ],
  ["GET", /^tags$/, (p) => `admin/${p}`],
  ["POST", /^tags$/, (p) => `admin/${p}`],
  ["PATCH", new RegExp(`^tags/${uuid}$`, "i"), (p) => `admin/${p}`],
  ["GET", /^tag-requests$/, (p) => `admin/${p}`],
  ["GET", new RegExp(`^tag-requests/${uuid}$`, "i"), (p) => `admin/${p}`],
  [
    "POST",
    new RegExp(`^tag-requests/${uuid}/(approve|reject)$`, "i"),
    (p) => `admin/${p}`,
  ],
  ["GET", new RegExp(`^skills/${uuid}/levels$`, "i"), (p) => `admin/${p}`],
  ["POST", new RegExp(`^skills/${uuid}/levels$`, "i"), (p) => `admin/${p}`],
  [
    "PATCH",
    new RegExp(`^skills/${uuid}/levels/${uuid}$`, "i"),
    (p) => `admin/${p}`,
  ],
  ["GET", /^users$/, (p) => `admin/${p}`],
  ["POST", /^users\/staff$/, (p) => `admin/${p}`],
  [
    "POST",
    new RegExp(`^users/${uuid}/(lock|unlock)$`, "i"),
    (p) => `admin/${p}`,
  ],
  ["PUT", new RegExp(`^users/${uuid}/roles/staff$`, "i"), (p) => `admin/${p}`],
  [
    "DELETE",
    new RegExp(`^users/${uuid}/roles/staff$`, "i"),
    (p) => `admin/${p}`,
  ],
  ["POST", /^reauthenticate$/, () => "auth/reauthenticate"],
  ["GET", /^skills$/, (p) => `admin/${p}`],
  ["POST", /^skills$/, (p) => `admin/${p}`],
  ["PATCH", new RegExp(`^skills/${uuid}$`, "i"), (p) => `admin/${p}`],
  [
    "POST",
    new RegExp(`^skills/${uuid}/(archive|restore)$`, "i"),
    (p) => `admin/${p}`,
  ],
  [
    "GET",
    /^moderation-rules$/,
    () => "admin/learning-requests/moderation-rules",
  ],
  [
    "PUT",
    /^moderation-rules$/,
    () => "admin/learning-requests/moderation-rules",
  ],
];
export type Portal = "admin" | "staff";
export function upstreamPath(
  method: string,
  path: string,
  portal: Portal = "staff",
): string | null {
  return (
    [...routes, ...(portal === "admin" ? adminRoutes : [])].find(
      ([verb, pattern]) => verb === method && pattern.test(path),
    )?.[2](path) ?? null
  );
}
export { sameOriginMutation } from "../auth/origin";
export function staffIdentity(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (
    typeof v.userId !== "string" ||
    v.accountStatus !== "ACTIVE" ||
    v.emailVerified !== true ||
    !Array.isArray(v.roles) ||
    !v.roles.every((r) => typeof r === "string") ||
    !v.roles.some((r) => r === "STAFF" || r === "ADMIN")
  )
    return null;
  const profile = v.profile as { fullName?: unknown } | undefined;
  return {
    userId: v.userId,
    roles: v.roles as string[],
    fullName:
      typeof profile?.fullName === "string" ? profile.fullName : "Nhân viên",
  };
}
export function safeDownload(
  value: unknown,
): value is { url: string; expiresAt: string } {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (
    typeof v.url !== "string" ||
    typeof v.expiresAt !== "string" ||
    Date.parse(v.expiresAt) <= Date.now() ||
    !Number.isFinite(Date.parse(v.expiresAt))
  )
    return false;
  try {
    const u = new URL(v.url);
    return (
      !u.username &&
      !u.password &&
      (u.protocol === "https:" ||
        (u.protocol === "http:" &&
          ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname)))
    );
  } catch {
    return false;
  }
}
