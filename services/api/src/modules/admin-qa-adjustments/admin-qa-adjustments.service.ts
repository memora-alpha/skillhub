import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../../infrastructure/database/prisma.service";
import type { TransactionContext } from "../../infrastructure/database/transaction-context";
import { IdempotencyService } from "../../infrastructure/idempotency/idempotency.service";
import type { PermissionCode } from "../../shared/authorization/permission.catalog";
import { lockUsers } from "../../shared/database/identity-transactions";
import { AuditWriter } from "../audit/application/services/audit-writer";
import {
  SessionsService,
  type Principal,
} from "../auth/application/services/sessions.service";
import { CreditOperationsService } from "../credit/application/services/credit-operations.service";
import {
  formatCredit,
  MAX_CREDIT_UNITS,
  parseCredit,
} from "../credit/domain/money";
import {
  ReputationService,
  reputationLevel,
} from "../reputation/application/services/reputation.service";

function auditMetadata(actor: Principal, userId: string, reason: string) {
  return {
    actor: { kind: "HUMAN", userId: actor.userId, roles: ["ADMIN"] },
    target: { type: "USER", id: userId },
    reason,
    context: { requestId: randomUUID(), correlationId: randomUUID() },
  } as const;
}

@Injectable()
export class AdminQaAdjustmentsService {
  constructor(
    private readonly config: ConfigService,
    private readonly db: PrismaService,
    private readonly idempotency: IdempotencyService,
    private readonly audit: AuditWriter,
    private readonly credit: CreditOperationsService,
    private readonly reputation: ReputationService,
    private readonly sessions: SessionsService,
  ) {}

  async grantCredit(
    actor: Principal,
    userId: string,
    input: { amount: string; reason: string },
    key: string | undefined,
  ) {
    const operation = "credit:adjust:qa";
    this.requireAccess(actor, operation);
    const amount = parseCredit(input.amount);
    if (amount <= 0n || amount > MAX_CREDIT_UNITS)
      throw new BadRequestException("INVALID_CREDIT_AMOUNT");
    const { reason } = input;
    const metadata = auditMetadata(actor, userId, reason);
    const { value } = await this.idempotency.execute(
      {
        scope: actor.userId,
        operation,
        key: key ?? "",
        command: { userId, amount: amount.toString(), reason },
      },
      async (tx) => {
        await this.target(tx, userId);
        const referenceId = randomUUID();
        const { operationId } = await this.credit.adjustAvailable(tx, {
          userId,
          amount,
          actorId: actor.userId,
          reason,
          referenceId,
          idempotencyKey: `qa-credit:${referenceId}`,
          systemAdjustment: true,
        });
        const entry = await tx.creditTransaction.findUniqueOrThrow({
          where: { operationId_entryNo: { operationId, entryNo: 1 } },
        });
        await this.audit.append(tx, {
          ...metadata,
          action: "CREDIT_ADJUST",
          before: { balanceBefore: (entry.availableAfter - amount).toString() },
          after: {
            balanceAfter: entry.availableAfter.toString(),
            amount: amount.toString(),
            operationId,
            referenceId,
          },
        });
        return { id: operationId, status: "SUCCESS" };
      },
      (tx) => this.authorize(tx, actor, operation),
    );
    const entry = await this.db.creditTransaction.findUniqueOrThrow({
      where: { operationId_entryNo: { operationId: value.id, entryNo: 1 } },
    });
    return {
      operationId: value.id,
      availableBefore: formatCredit(
        entry.availableAfter - entry.availableDelta,
      ),
      availableAfter: formatCredit(entry.availableAfter),
    };
  }

  async setReputation(
    actor: Principal,
    userId: string,
    input: {
      targetScore: number;
      reason: string;
      releaseLowReputationRestrictions?: boolean;
    },
    key: string | undefined,
  ) {
    const operation = "reputation:adjust:qa";
    this.requireAccess(actor, operation);
    const {
      targetScore,
      reason,
      releaseLowReputationRestrictions = false,
    } = input;
    if (releaseLowReputationRestrictions && targetScore < 40)
      throw new BadRequestException("REPUTATION_RELEASE_REQUIRES_SCORE_40");
    const metadata = auditMetadata(actor, userId, reason);
    const { value } = await this.idempotency.execute(
      {
        scope: actor.userId,
        operation,
        key: key ?? "",
        command: {
          userId,
          targetScore,
          reason,
          releaseLowReputationRestrictions,
        },
      },
      async (tx) => {
        await lockUsers(tx, [userId]);
        const user = await this.target(tx, userId);
        const [clock] = await tx.$queryRaw<
          { now: Date }[]
        >`SELECT CURRENT_TIMESTAMP AS now`;
        if (!(clock?.now instanceof Date))
          throw new ConflictException("DATABASE_TIME_UNAVAILABLE");
        const delta = targetScore - user.reputationScore;
        const revoked = releaseLowReputationRestrictions
          ? await this.reputation.releaseLowReputationRestrictions(
              tx,
              userId,
              clock.now,
            )
          : { count: 0 };
        if (delta === 0 && revoked.count === 0)
          throw new ConflictException("REPUTATION_SCORE_UNCHANGED");
        const sourceId = randomUUID();
        const eventKey = `qa-reputation:${sourceId}`;
        await this.reputation.apply(tx, {
          userId,
          delta,
          reasonCode: "QA_ADMIN_ADJUSTMENT",
          sourceType: "QA_ADMIN_ADJUSTMENT",
          sourceId,
          eventKey,
          now: clock.now,
          evaluateRestriction: delta < 0,
        });
        if (revoked.count > 0) {
          await this.audit.append(tx, {
            ...metadata,
            action: "USER_RESTRICTION_REVOKE",
            after: {
              score: targetScore,
              restrictions: [],
              revokedCount: revoked.count,
            },
          });
        }
        await this.audit.append(tx, {
          ...metadata,
          action: "REPUTATION_ADJUST",
          before: { score: user.reputationScore },
          after: { score: targetScore },
        });
        const event = await tx.reputationHistory.findUniqueOrThrow({
          where: { eventKey },
        });
        return { id: event.id, status: "SUCCESS" };
      },
      (tx) => this.authorize(tx, actor, operation),
    );
    const event = await this.db.reputationHistory.findUniqueOrThrow({
      where: { id: value.id },
    });
    return {
      historyId: event.id,
      scoreBefore: event.scoreBefore,
      scoreAfter: event.scoreAfter,
      level: reputationLevel(event.scoreAfter),
    };
  }

  requireEnabled() {
    const tier = this.config.get<string>("APP_DEPLOYMENT_TIER");
    if (
      (tier !== "local" && tier !== "staging") ||
      this.config.get<boolean>("QA_ADMIN_ADJUSTMENTS_ENABLED") !== true
    )
      throw new NotFoundException("QA_ADMIN_ADJUSTMENTS_DISABLED");
  }

  private requireAccess(actor: Principal, permission: PermissionCode) {
    this.requireEnabled();
    if (
      !actor.roles.includes("ADMIN") ||
      !actor.permissions.includes(permission)
    )
      throw new ForbiddenException("QA_ADMIN_ADJUSTMENT_FORBIDDEN");
  }

  private async authorize(
    tx: TransactionContext,
    actor: Principal,
    permission: PermissionCode,
  ) {
    const live = await this.sessions.assertLive(tx, actor);
    this.requireAccess(live, permission);
  }

  private async target(tx: TransactionContext, userId: string) {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { reputationScore: true },
    });
    if (!user) throw new NotFoundException("USER_NOT_FOUND");
    return user;
  }
}
