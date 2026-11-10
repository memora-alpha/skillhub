/** Forward only filters supported by the selected upstream endpoint. */
export function staffQuery(path: string, query: URLSearchParams) {
  const names = [
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
    names.push("userId", "from", "to", "operationId", "referenceId");
  if (path === "payments")
    names.push("userId", "from", "to", "orderCode", "gatewayTransactionId");
  if (path === "reports/support/queue") names.push("severity", "handlerId");
  const accepted = new URLSearchParams();
  for (const name of names)
    if (query.has(name)) accepted.set(name, query.get(name)!);
  return accepted.size ? `?${accepted}` : "";
}
