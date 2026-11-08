import { Injectable } from "@nestjs/common";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
@Injectable()
export class SessionOverviewReader {
  async batch(tx: TransactionContext, pathIds: string[]) {
    const sessions = await tx.session.findMany({
      where: { pathId: { in: pathIds } },
      orderBy: [{ startAt: "asc" }, { id: "asc" }],
    });
    const outcomes = await tx.sessionAttendanceOutcome.findMany({
      where: { sessionId: { in: sessions.map((row) => row.id) } },
    });
    const current = outcomes.filter((outcome) =>
      sessions.some(
        (session) =>
          session.id === outcome.sessionId &&
          +session.startAt === +outcome.occurrenceStartAt,
      ),
    );
    const excuses = await tx.sessionAbsenceExcuse.findMany({
      where: { outcomeId: { in: current.map((row) => row.id) } },
      select: {
        outcomeId: true,
        status: true,
        reason: true,
        absentUserId: true,
      },
    });
    return sessions.map((session) => {
      const outcome =
        current.find((row) => row.sessionId === session.id) ?? null;
      return {
        session,
        outcome,
        excuse: excuses.find((row) => row.outcomeId === outcome?.id) ?? null,
      };
    });
  }
}
