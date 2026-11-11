import type { UserReport } from "../api/reports-api";
import { canWriteCase } from "./case-actions";

type SessionReport = Pick<
  UserReport,
  "id" | "targetType" | "targetId" | "relatedSessionId" | "status" | "createdAt"
>;

// Prefer the open case; otherwise expose the most recent report for this session.
export function selectSessionReport<T extends SessionReport>(
  rows: readonly T[],
  sessionId: string,
) {
  return rows
    .filter(
      (row) =>
        row.targetType === "SESSION" &&
        (row.relatedSessionId ?? row.targetId) === sessionId,
    )
    .sort(
      (a, b) =>
        Number(canWriteCase(b.status)) - Number(canWriteCase(a.status)) ||
        (b.createdAt ? Date.parse(b.createdAt) : -Infinity) -
          (a.createdAt ? Date.parse(a.createdAt) : -Infinity) ||
        b.id.localeCompare(a.id),
    )[0];
}
