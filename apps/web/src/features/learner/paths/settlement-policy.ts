export type SettlementReceipt = {
  pathId: string;
  status: "COMPLETED";
  operationId: string | null;
  gross: string | null;
  fee: string | null;
};
export function settlementReceipt(
  value: unknown,
  pathId: string,
): SettlementReceipt {
  if (!value || typeof value !== "object")
    throw new Error("API_RESPONSE_INVALID");
  const row = value as Record<string, unknown>;
  const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
  const credit = (v: unknown) =>
    v === null || (typeof v === "string" && /^\d+(?:\.\d{1,2})?$/.test(v));
  if (
    row.pathId !== pathId ||
    row.status !== "COMPLETED" ||
    !(
      row.operationId === null ||
      (typeof row.operationId === "string" && uuid.test(row.operationId))
    ) ||
    !credit(row.gross) ||
    !credit(row.fee)
  )
    throw new Error("API_RESPONSE_INVALID");
  return row as SettlementReceipt;
}
export function allSessionsCompleted(path: {
  plans: { totalSessions: number; sessions: { status: string }[] }[];
}) {
  return (
    path.plans.length > 0 &&
    path.plans.every(
      (plan) =>
        plan.totalSessions > 0 &&
        plan.sessions.length === plan.totalSessions &&
        plan.sessions.every((session) => session.status === "COMPLETED"),
    )
  );
}
