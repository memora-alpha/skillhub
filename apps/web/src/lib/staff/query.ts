/** Forward only filters supported by the selected upstream endpoint. */
export function staffQuery(path: string, query: URLSearchParams) {
  const accepted = new URLSearchParams();
  for (const name of staffQueryNames(path))
    for (const value of query.getAll(name)) accepted.append(name, value);
  if (
    path === "reports/support/queue" &&
    ["ALL", "CLOSED"].includes(accepted.get("status") ?? "")
  )
    accepted.delete("status");
  return accepted.size ? `?${accepted}` : "";
}
const additionalQueryNames = new Map<string, readonly string[]>([
  ["fee-revenue", ["from", "to", "granularity"]],
  [
    "credit/transactions",
    [
      "userId",
      "from",
      "to",
      "before",
      "includeTotal",
      "operationId",
      "referenceId",
    ],
  ],
  [
    "payments",
    [
      "userId",
      "from",
      "to",
      "before",
      "includeTotal",
      "paidFrom",
      "paidBefore",
      "orderCode",
      "gatewayTransactionId",
    ],
  ],
  ["reports/support/queue", ["severity", "handlerId", "contentReview"]],
  ["learning-requests", ["keyword", "skillId", "tagIds"]],
  ["materials", ["skillId", "accessType", "ownerId", "from", "to"]],
  [
    "dashboard/work-items",
    ["kind", "severity", "waitingOn", "assignee", "minAgeHours", "sort"],
  ],
  ["learning-paths", ["participantId"]],
]);

function staffQueryNames(path: string): string[] {
  if (
    path === "profanity-rules/revisions" ||
    path === "content-moderation/chat-attachments"
  )
    return ["before"];
  if (
    /^sessions\/[0-9a-f-]{36}\/(whiteboard|recordings\/[0-9a-f-]{36})\/staff-review$/i.test(
      path,
    )
  )
    return ["caseId"];
  if (path.startsWith("rewards/"))
    return ["limit", "cursor", "status", "productId", "userId"];
  if (path === "subscriptions/plans")
    return ["limit", "cursor", "planCode", "status"];
  if (path === "subscriptions")
    return ["limit", "cursor", "status", "planCode", "userId"];
  if (path === "audit-logs")
    return [
      "limit",
      "cursor",
      "actorId",
      "action",
      "targetType",
      "targetId",
      "from",
      "to",
    ];
  if (path === "dashboard/summary") return ["from", "to", "timezone"];
  if (path === "dashboard/trends")
    return ["from", "to", "timezone", "granularity"];
  const names = /^dashboard\/(overview|learning|finance)$/.test(path)
    ? ["from", "to", "timezone", "granularity", "sections"]
    : [
        "cursor",
        "after",
        "limit",
        "status",
        "role",
        "categoryId",
        "q",
        "unreadOnly",
        "type",
        "referenceType",
      ];
  return names.concat(additionalQueryNames.get(path) ?? []);
}
