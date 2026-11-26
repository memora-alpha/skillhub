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
function staffQueryNames(path: string): string[] {
  if (path === "profanity-rules/revisions") return ["before"];
  if (path.startsWith("rewards/"))
    return ["limit", "cursor", "status", "productId", "userId"];
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
  if (path === "fee-revenue") names.push("from", "to", "granularity");
  if (path === "credit/transactions")
    names.push(
      "userId",
      "from",
      "to",
      "before",
      "includeTotal",
      "operationId",
      "referenceId",
    );
  if (path === "payments")
    names.push(
      "userId",
      "from",
      "to",
      "before",
      "includeTotal",
      "paidFrom",
      "paidBefore",
      "orderCode",
      "gatewayTransactionId",
    );
  if (path === "reports/support/queue") names.push("severity", "handlerId");
  if (path === "learning-requests") names.push("keyword", "skillId", "tagIds");
  if (path === "materials")
    names.push("skillId", "accessType", "ownerId", "from", "to");
  if (path === "dashboard/work-items")
    names.push(
      "kind",
      "severity",
      "waitingOn",
      "assignee",
      "minAgeHours",
      "sort",
    );
  if (path === "learning-paths") names.push("participantId");
  return names;
}
