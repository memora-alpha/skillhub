const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const route = (pattern: string) => new RegExp("^" + pattern + "$", "i");
const allowed: Record<string, RegExp[]> = {
  GET: [
    route("me"),
    route("me/(skills|wallet|achievements)"),
    route("me/wallet/transactions(/" + uuid + ")?"),
    route("payments(/(creation-policy|" + uuid + "))?"),
    route("materials(/" + uuid + "(/download)?)?"),
    route("me/material-orders"),
    route("me/materials(/files/" + uuid + ")?"),
    route(
      "me/skills/" +
        uuid +
        "/(verifications(/" +
        uuid +
        ")?|evidence-files/" +
        uuid +
        ")",
    ),
    route("notifications"),
    route("reports/mine(/" + uuid + ")?"),
    route("skills"),
    route("skills/" + uuid + "(/levels)?"),
    route("profiles/" + uuid),
    route("learning-requests(/(mine|recommended|" + uuid + "))?"),
    route("proposals(/" + uuid + ")?"),
    route(
      "conversations(/" +
        uuid +
        "(/messages|/message-deliveries/" +
        uuid +
        ")?)?",
    ),
    route("learning-paths/(mine|" + uuid + ")"),
    route("sessions/(mine|" + uuid + ")"),
  ],
  POST: [
    route("sessions/paths/" + uuid + "/settlement"),
    route("me/materials(/files|/" + uuid + "/(submit|archive))?"),
    route("me/skills/" + uuid + "/(evidence-files|verifications)"),
    route("payments(/" + uuid + "/cancel)?"),
    route("materials/" + uuid + "/(purchase|reports)"),
    route("reports/sessions/" + uuid),
    route("me/skills"),
    route("learning-requests(/" + uuid + "/(publish|cancel))?"),
    route("proposals(/" + uuid + "/(accept|reject|withdraw))?"),
    route("conversations/" + uuid + "/(messages|read)"),
    route("learning-paths"),
    route(
      "learning-paths/" + uuid + "/(confirm|plans|final-validation|finalize)",
    ),
    route("learning-paths/plans/" + uuid + "/confirm"),
    route("learning-plans/" + uuid + "/schedule-proposals"),
    route("schedule-proposals/" + uuid + "/confirm"),
    route(
      "sessions/" +
        uuid +
        "/(livekit-token|confirm-completion|absence-excuse|absence-excuse/decision|reschedule-proposals)",
    ),
  ],
  PATCH: [
    route("me/achievements/selected-title"),
    route("me/profile"),
    route("notifications/" + uuid + "/read"),
    route("learning-requests/" + uuid),
    route("proposals/" + uuid),
    route("learning-paths/" + uuid),
    route("learning-paths/plans/" + uuid),
    route("schedule-proposals/" + uuid),
  ],
};
export function userUpstreamPath(method: string, segments: string[]) {
  if (!segments.length || segments.some((part) => !/^[a-z0-9-]+$/i.test(part)))
    return null;
  const path = segments.join("/");
  return allowed[method]?.some((pattern) => pattern.test(path)) ? path : null;
}
export function userQuery(search: URLSearchParams) {
  const result = new URLSearchParams();
  for (const name of [
    "limit",
    "cursor",
    "keyword",
    "q",
    "skillId",
    "direction",
    "status",
    "from",
    "to",
    "tagIds",
    "afterSequence",
    "learningRequestId",
    "includeArchived",
    "page",
    "accessType",
    "unreadOnly",
  ]) {
    for (const value of search.getAll(name)) result.append(name, value);
  }
  return result.size ? "?" + result : "";
}
export function userIdentity(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (
    typeof v.userId !== "string" ||
    v.accountStatus !== "ACTIVE" ||
    v.emailVerified !== true ||
    !Array.isArray(v.roles) ||
    !v.roles.includes("USER") ||
    typeof v.email !== "string" ||
    !v.profile ||
    typeof v.profile !== "object"
  )
    return null;
  const profile = v.profile as Record<string, unknown>;
  if (typeof profile.fullName !== "string") return null;
  return {
    userId: v.userId,
    email: v.email,
    roles: ["USER"],
    profile: {
      fullName: profile.fullName,
      avatarUrl:
        typeof profile.avatarUrl === "string" ? profile.avatarUrl : null,
    },
  };
}
