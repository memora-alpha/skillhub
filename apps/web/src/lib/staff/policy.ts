const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const routes: [string, RegExp, (path: string) => string][] = [
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
  ["GET", /^users$/, (p) => `admin/${p}`],
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
export function sameOriginMutation(request: Request): boolean {
  return (
    request.headers.get("origin") === new URL(request.url).origin &&
    request.headers.get("sec-fetch-site") !== "cross-site"
  );
}
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
