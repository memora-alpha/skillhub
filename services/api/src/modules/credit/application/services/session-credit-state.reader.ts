import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";

/** Caller holds the Path lifecycle lock. Successful makeup supersedes the original absence. */
export async function readSessionCreditState(
  tx: TransactionContext,
  pathId: string,
) {
  const sessions = await tx.session.findMany({
    where: { pathId },
    orderBy: { id: "asc" },
  });
  const outcomes = await tx.sessionAttendanceOutcome.findMany({
    where: { sessionId: { in: sessions.map((row) => row.id) } },
  });
  const byOccurrence = new Map(
    outcomes.map((row) => [`${row.sessionId}:${+row.occurrenceStartAt}`, row]),
  );
  return sessions.map((row) => {
    const outcome = byOccurrence.get(`${row.id}:${+row.startAt}`);
    return {
      ...row,
      teacherAbsentWithoutMakeup:
        outcome !== undefined &&
        ["FINAL", "EXCUSED"].includes(outcome.status) &&
        outcome.finalizedAt !== null &&
        outcome.teacherVerdict === "ABSENT" &&
        outcome.learnerVerdict === "PRESENT",
      creditAttendance: outcome
        ? {
            id: outcome.id,
            status: outcome.status,
            resolution: outcome.resolution,
            teacherVerdict: outcome.teacherVerdict,
            learnerVerdict: outcome.learnerVerdict,
            finalizedAt: outcome.finalizedAt?.toISOString() ?? null,
          }
        : null,
    };
  });
}
