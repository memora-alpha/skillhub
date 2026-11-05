import { BadRequestException, ConflictException } from "@nestjs/common";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import { byCodeUnit } from "../../../../infrastructure/idempotency/idempotency.service";

type MakeupSession = {
  id: string;
  pathId: string;
  teacherId: string;
  learnerId: string;
  makeupCount: number;
};

/** Caller holds the Path lock for decisions. Quotas span both directions in one agreement. */
export async function makeupQuotas(
  tx: TransactionContext,
  session: MakeupSession,
  userIds: string[],
) {
  const users = [...new Set(userIds)].sort(byCodeUnit);
  if (!users.length) throw new BadRequestException("MAKEUP_USER_REQUIRED");
  if (users.some((id) => id !== session.teacherId && id !== session.learnerId))
    throw new BadRequestException("MAKEUP_USER_NOT_PARTICIPANT");
  const rows = await tx.session.findMany({
    where: { pathId: session.pathId },
    select: {
      teacherId: true,
      learnerId: true,
      makeupCount: true,
      makeupUserIds: true,
    },
  });
  return users.map((userId) => {
    const own = rows.filter(
      (row) => row.teacherId === userId || row.learnerId === userId,
    );
    const limit = Math.max(1, Math.floor(own.length / 5));
    const used = own.reduce(
      (total, row) =>
        total + (row.makeupUserIds.includes(userId) ? row.makeupCount : 0),
      0,
    );
    const requiresReview = own.some(
      (row) =>
        (row.makeupCount > 1 && row.makeupUserIds.length > 1) ||
        (row.makeupCount > 0 && row.makeupUserIds.length === 0),
    );
    let reason: string | null = null;
    if (session.makeupCount > 0) reason = "SESSION_MAKEUP_LIMIT_REACHED";
    else if (requiresReview) reason = "MAKEUP_ATTRIBUTION_REVIEW_REQUIRED";
    else if (used >= limit) reason = "USER_MAKEUP_LIMIT_REACHED";
    return {
      userId,
      totalSessions: own.length,
      limit,
      used,
      remaining: Math.max(0, limit - used),
      requiresReview,
      reason,
    };
  });
}

export async function makeupQuota(
  tx: TransactionContext,
  session: MakeupSession,
  userId: string,
) {
  return (await makeupQuotas(tx, session, [userId]))[0]!;
}

export async function reserveMakeup(
  tx: TransactionContext,
  session: MakeupSession,
  userIds: string[],
) {
  const quotas = await makeupQuotas(tx, session, userIds);
  const blocked = quotas.find((quota) => quota.reason);
  if (blocked) throw new ConflictException(blocked.reason!);
  await tx.session.update({
    where: { id: session.id },
    data: {
      makeupCount: { increment: 1 },
      makeupUserIds: quotas.map((quota) => quota.userId),
    },
  });
}
