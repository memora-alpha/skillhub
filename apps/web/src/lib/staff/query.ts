/** Forward only filters supported by the selected upstream endpoint. */
export function staffQuery(path: string, query: URLSearchParams) {
  const accepted = new URLSearchParams();
  for (const name of staffQueryNames(path))
    if (query.has(name)) accepted.set(name, query.get(name)!);
  return accepted.size ? `?${accepted}` : "";
}
function staffQueryNames(path: string): string[] {
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
  if (path === "reports/support/queue")
    names.push("severity", "handlerId", "source");
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
