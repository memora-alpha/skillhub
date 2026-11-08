import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { TransactionRunner } from "../../../../infrastructure/database/transaction-runner";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import {
  SessionsService,
  type Principal,
} from "../../../auth/application/services/sessions.service";
import { AuditService } from "../../../audit/application/services/audit.service";
import { validateReason } from "../../../audit/domain/reason.policy";
import {
  listInput,
  listBoundary,
  listResult,
} from "../../../../shared/http/list-page";
@Injectable()
export class ReviewModerationService {
  constructor(
    private readonly transactions: TransactionRunner,
    private readonly sessions: SessionsService,
    private readonly audit: AuditService,
  ) {}
  private async authorize(tx: TransactionContext, actor: Principal) {
    const live = await this.sessions.assertLive(tx, actor);
    if (
      !live.roles.some((role) => role === "ADMIN" || role === "STAFF") ||
      !live.permissions.includes("review:moderate")
    )
      throw new ForbiddenException("REVIEW_MODERATION_REQUIRED");
    return live;
  }
  list(actor: Principal, query: { limit?: number; cursor?: string }) {
    const scope = JSON.stringify(["review-moderation-v1", actor.userId]),
      { limit, cursor } = listInput(query, scope);
    return this.transactions.run(async (tx) => {
      await this.authorize(tx, actor);
      const rows = await tx.review.findMany({
        where: listBoundary("createdAt", cursor),
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: limit + 1,
      });
      return listResult(rows, limit, scope, (row) => row.createdAt);
    });
  }
  change(
    actor: Principal,
    id: string,
    input: { hidden: boolean; expectedVersion: number; reason: string },
  ) {
    const reason = validateReason(input.reason, { min: 3, max: 1000 });
    return this.transactions.run(async (tx) => {
      await this.authorize(tx, actor);
      await tx.$queryRaw`SELECT review_id FROM reviews WHERE review_id=${id}::uuid FOR UPDATE`;
      const live = await this.authorize(tx, actor);
      const review = await tx.review.findUnique({ where: { id } });
      if (!review) throw new NotFoundException("REVIEW_NOT_FOUND");
      if ([review.reviewerId, review.revieweeId].includes(live.userId))
        throw new ForbiddenException("REVIEW_SELF_MODERATION_FORBIDDEN");
      if (review.moderationVersion !== input.expectedVersion)
        throw new ConflictException("STALE_REVIEW_VERSION");
      const [clock] = await tx.$queryRaw<
        { now: Date }[]
      >`SELECT CURRENT_TIMESTAMP AS now`;
      if (!clock?.now) throw new ConflictException("DATABASE_TIME_UNAVAILABLE");
      const result = await tx.review.update({
        where: { id },
        data: {
          hiddenAt: input.hidden ? clock.now : null,
          moderationVersion: { increment: 1 },
        },
      });
      await this.audit.append(tx, {
        actorId: live.userId,
        actorRole: live.roles.includes("ADMIN") ? "ADMIN" : "STAFF",
        action: input.hidden ? "REVIEW_HIDE" : "REVIEW_RESTORE",
        targetType: "Review",
        targetId: id,
        reason,
        before: { hidden: !!review.hiddenAt },
        after: { hidden: !!result.hiddenAt, version: result.moderationVersion },
      });
      // Visibility changes deliberately leave the original reputation history untouched.
      return {
        id,
        hiddenAt: result.hiddenAt,
        version: result.moderationVersion,
      };
    });
  }
}
