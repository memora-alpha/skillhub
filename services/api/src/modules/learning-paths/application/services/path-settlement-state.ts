import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import { lockLearningPath } from "./learning-path-lock";

const waitingCodes = new Set([
  "LEARNING_PATH_NOT_SETTLEABLE",
  "PATH_SESSIONS_INCOMPLETE",
  "SETTLEMENT_BLOCKED_BY_DISPUTE",
  "DISPUTE_WINDOW_OPEN",
  "SETTLEMENT_BLOCKED_BY_TERMINATION",
]);
const reviewCodes = new Set([
  "APPROVED_FEE_POLICY_REQUIRED",
  "UNSUPPORTED_FEE_POLICY",
  "PATH_HOLD_ALLOCATION_MISSING",
  "PATH_HOLD_BALANCE_MISMATCH",
  "PATH_SETTLEMENT_REQUIRES_PATH_SNAPSHOT",
  "LOCKED_PATH_VERSION_MISSING",
  "REQUEST_LIFECYCLE_INCONSISTENT",
  "PATH_SESSIONS_MISSING",
  "CREDIT_PROVENANCE_REVIEW_REQUIRED",
  "CREDIT_PROVENANCE_BALANCE_MISMATCH",
  "CREDIT_PROVENANCE_HOLD_MISMATCH",
  "SESSION_CREDIT_SNAPSHOT_MISSING",
  "SESSION_CREDIT_SNAPSHOT_INVALID",
  "SESSION_CREDIT_SNAPSHOT_MISMATCH",
  "SESSION_CREDIT_POLICY_REVIEW_REQUIRED",
]);

/** Never persist raw provider/database exception text in a participant-facing projection. */
export function settlementFailure(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (waitingCodes.has(message))
    return { outcome: "WAITING", errorCode: message };
  if (reviewCodes.has(message))
    return { outcome: "NEEDS_REVIEW", errorCode: message };
  return {
    outcome: "RETRYING",
    errorCode: "SETTLEMENT_TEMPORARILY_UNAVAILABLE",
  };
}

/** Called in a NEW transaction after financial rollback/commit; takes the same Path lock. */
export async function recordSettlementAttempt(
  tx: TransactionContext,
  pathId: string,
  failure?: unknown,
) {
  await lockLearningPath(tx, pathId);
  const path = await tx.learningPath.findUniqueOrThrow({
    where: { id: pathId },
  });
  const [clock] = await tx.$queryRaw<
    { now: Date }[]
  >`SELECT CURRENT_TIMESTAMP AS now`;
  if (!clock?.now) throw new Error("DATABASE_TIME_UNAVAILABLE");
  let result = failure
    ? settlementFailure(failure)
    : { outcome: "SETTLED", errorCode: null as string | null };
  if (path.settledAt) result = { outcome: "SETTLED", errorCode: null };
  if (path.status === "CANCELLED")
    result = { outcome: "TERMINATED", errorCode: null };
  await tx.pathSettlementAttempt.upsert({
    where: { pathId },
    create: { pathId, checkedAt: clock.now, ...result },
    update: { checkedAt: clock.now, attemptCount: { increment: 1 }, ...result },
  });
}

export function settlementRetryDelay(attempt: {
  outcome: string;
  attemptCount: number;
}) {
  if (attempt.outcome === "NEEDS_REVIEW") return 300_000;
  if (attempt.outcome === "RETRYING")
    return Math.min(
      300_000,
      30_000 * 2 ** Math.min(attempt.attemptCount - 1, 4),
    );
  return 0;
}
