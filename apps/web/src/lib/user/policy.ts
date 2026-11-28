const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const route = (pattern: string) => new RegExp("^" + pattern + "$", "i");
const allowed: Record<string, RegExp[]> = {
  GET: [
    route("rewards/products(/" + uuid + ")?"),
    route("rewards/redemptions(/" + uuid + ")?"),
    route("materials/" + uuid + "/(reviews|review-eligibility)"),
    route("me/skills/" + uuid + "/evidence/" + uuid + "/download"),
    route("reputation/recovery"),
    route("me/(notification-preferences|reviews)"),
    route("profiles/" + uuid + "/reviews"),
    route(
      "learning-paths/" +
        uuid +
        "/(overview|cases(/" +
        uuid +
        "/summary)?|termination-requests/quote)",
    ),
    route(
      "reports/support/cases/" +
        uuid +
        "/parties/" +
        uuid +
        "/(messages|evidence(/" +
        uuid +
        "/download)?)",
    ),
    route("reputation/me"),
    route("tags"),
    route("me/tag-requests(/" + uuid + ")?"),
    route("conversations/inbox"),
    route("conversations/" + uuid + "/attachments/" + uuid + "/status"),
    route(
      "conversations/" +
        uuid +
        "/messages/" +
        uuid +
        "/attachments/" +
        uuid +
        "/(download|content|preview|thumbnail)",
    ),
    route("subscriptions/plans"),
    route("me/subscription(/(upgrade-quote|charges))?"),
    route("me"),
    route("me/avatar/uploads/" + uuid),
    route("me/(skills|wallet|achievements)"),
    route("me/wallet/transactions(/" + uuid + ")?"),
    route("payments(/(creation-policy|" + uuid + "))?"),
    route("materials(/" + uuid + "(/download)?)?"),
    route("me/material-orders"),
    route("me/materials(/files/" + uuid + "|/" + uuid + ")?"),
    route("me/material-favorites"),
    route("me/material-library/free"),
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
    route("reports/evidence-files/" + uuid),
    route(
      "learning-paths/" +
        uuid +
        "/(settlement-status|reviews|termination-requests)",
    ),
    route("sessions/" + uuid + "/cancellation-requests"),
    route("skills"),
    route("skills/" + uuid + "(/levels)?"),
    route("skills/" + uuid + "/sharers"),
    route("profiles/" + uuid + "(/skills)?"),
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
    route("sessions/" + uuid + "/whiteboard"),
    route("sessions/" + uuid + "/recordings(/" + uuid + "/playback)?"),
  ],
  POST: [
    route("rewards/redemptions(/lookup)?"),
    route("materials/" + uuid + "/reviews"),
    route("material-reviews/" + uuid + "/reports"),
    route("me/materials/cover-files"),
    route("reputation/recovery/(quiz|claim)"),
    route("reputation/restrictions/policy-acknowledgement"),
    route(
      "reports/support/cases/" +
        uuid +
        "/parties/" +
        uuid +
        "/(messages|evidence)",
    ),
    route("me/material-orders/" + uuid + "/refund"),
    route("notifications/push-tokens"),
    route("me/avatar"),
    route("me/skills/" + uuid + "/(archive|restore)"),
    route("tag-requests"),
    route("conversations/" + uuid + "/attachments"),
    route("me/subscription(/(upgrade|recording-minutes))?"),
    route("sessions/paths/" + uuid + "/(settlement|settlement-consent)"),
    route("learning-paths/" + uuid + "/(reviews|termination-requests)"),
    route(
      "learning-paths/" +
        uuid +
        "/termination-requests/" +
        uuid +
        "/(response|withdraw|escalate)",
    ),
    route(
      "sessions/" +
        uuid +
        "/cancellation-requests(/" +
        uuid +
        "/(response|withdraw))?",
    ),
    route("reports/evidence-files"),
    route("me/materials(/files|/" + uuid + "/(submit|archive|withdraw))?"),
    route("materials/" + uuid + "/favorite"),
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
    route(
      "sessions/" + uuid + "/recordings(/" + uuid + "/(accept|decline|stop))?",
    ),
  ],
  PUT: [route("sessions/" + uuid + "/whiteboard")],
  PATCH: [
    route("material-reviews/" + uuid),
    route("me/notification-preferences"),
    route("me/subscription"),
    route("me/materials/" + uuid),
    route("me/skills/" + uuid),
    route("me/achievements/selected-title"),
    route("me/profile"),
    route("notifications/" + uuid + "/read"),
    route("learning-requests/" + uuid),
    route("proposals/" + uuid),
    route("learning-paths/" + uuid),
    route("learning-paths/plans/" + uuid),
    route("schedule-proposals/" + uuid),
  ],
  DELETE: [
    route("me/materials/" + uuid),
    route("materials/" + uuid + "/favorite"),
    route("me/avatar"),
    route("notifications/push-tokens/" + uuid),
    route("material-reviews/" + uuid),
    route("sessions/" + uuid + "/recordings/" + uuid),
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
    "locale",
    "brandId",
    "category",
    "cursor",
    "keyword",
    "q",
    "skillId",
    "categoryId",
    "ownerId",
    "direction",
    "status",
    "from",
    "to",
    "tagIds",
    "afterSequence",
    "learningRequestId",
    "includeArchived",
    "verifiedOnly",
    "page",
    "accessType",
    "unreadOnly",
    "expectedVersion",
    "expectedListingVersion",
    "type",
    "referenceType",
    "planCode",
  ]) {
    for (const value of search.getAll(name)) result.append(name, value);
  }
  return result.size ? "?" + result : "";
}
const bodylessPostPatterns: readonly RegExp[] = [
  /^payments\/[0-9a-f-]+\/cancel$/i,
  /^sessions\/paths\/[0-9a-f-]+\/settlement$/i,
  /^sessions\/[0-9a-f-]+\/recordings$/i,
  /^sessions\/[0-9a-f-]+\/recordings\/[0-9a-f-]+\/(accept|decline|stop)$/i,
  /^me\/material-orders\/[0-9a-f-]+\/refund$/i,
  /^materials\/[0-9a-f-]+\/favorite$/i,
];
export function isBodyless(method: string, target: string) {
  if (method === "POST" && target === "rewards/redemptions/lookup") return true;
  if (method === "PATCH")
    return /^notifications\/[0-9a-f-]+\/read$/i.test(target);
  return (
    method === "POST" &&
    bodylessPostPatterns.some((pattern) => pattern.test(target))
  );
}
export function userIdentity(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (
    typeof v.userId !== "string" ||
    v.accountStatus !== "ACTIVE" ||
    v.emailVerified !== true ||
    !Array.isArray(v.roles) ||
    !v.roles.some((role) => role === "USER" || role === "STAFF") ||
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
    roles: v.roles.filter((role): role is string => typeof role === "string"),
    profile: {
      fullName: profile.fullName,
      avatarUrl:
        typeof profile.avatarUrl === "string" ? profile.avatarUrl : null,
    },
  };
}
