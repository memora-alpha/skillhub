import { ConflictException } from "@nestjs/common";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";

type MakeupSession = {
  id: string;
  pathId: string;
  planId: string;
  planVersion: number;
  makeupCount: number;
};

/** Caller holds the Path lock. Floor 20%, with one opportunity for plans shorter than five. */
export async function makeupQuota(
  tx: TransactionContext,
  session: MakeupSession,
) {
  const rows = await tx.session.findMany({
    where: {
      pathId: session.pathId,
      planId: session.planId,
      planVersion: session.planVersion,
    },
    select: { makeupCount: true },
  });
  const limit = Math.max(1, Math.floor(rows.length / 5));
  const used = rows.filter((row) => row.makeupCount > 0).length;
  let reason: string | null = null;
  if (session.makeupCount > 0) reason = "SESSION_MAKEUP_LIMIT_REACHED";
  else if (used >= limit) reason = "PLAN_MAKEUP_LIMIT_REACHED";
  return { limit, used, remaining: Math.max(0, limit - used), reason };
}

export async function reserveMakeup(
  tx: TransactionContext,
  session: MakeupSession,
) {
  const quota = await makeupQuota(tx, session);
  if (quota.reason) throw new ConflictException(quota.reason);
  await tx.session.update({
    where: { id: session.id },
    data: { makeupCount: { increment: 1 } },
  });
}
