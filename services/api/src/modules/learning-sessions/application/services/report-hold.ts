import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import {
  reportedSessionIds,
  WHITEBOARD_HOLD_REPORT_STATUSES,
} from "../../domain/whiteboard.policy";

type Reader = Pick<TransactionContext, "reportCase">;

/**
 * Sessions among `sessionIds` that an open report (OPEN, UNDER_REVIEW, NEED_MORE_INFO)
 * targets or relates to. Spec 019 P2/P3 and spec 020 D6/D7 share this hold.
 */
export async function sessionsHeldByReport(
  reader: Reader,
  sessionIds: readonly string[],
): Promise<Set<string>> {
  if (sessionIds.length === 0) return new Set();
  const ids = [...sessionIds];
  const open = await reader.reportCase.findMany({
    where: {
      status: { in: [...WHITEBOARD_HOLD_REPORT_STATUSES] },
      OR: [
        { relatedSessionId: { in: ids } },
        { targetType: "SESSION", targetId: { in: ids } },
      ],
    },
    select: { relatedSessionId: true, targetType: true, targetId: true },
  });
  const wanted = new Set(ids);
  return new Set(
    open.flatMap(reportedSessionIds).filter((id) => wanted.has(id)),
  );
}
