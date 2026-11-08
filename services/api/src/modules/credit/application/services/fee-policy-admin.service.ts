import {
  BadRequestException,
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
import { ReauthProofService } from "../../../auth/application/services/reauth-proof.service";
import { AuditService } from "../../../audit/application/services/audit.service";
import { lockUsers } from "../../../../shared/database/identity-transactions";
import { databaseNow } from "../../../learning-sessions/application/services/session-tx";
import { validateReason } from "../../../audit/domain/reason.policy";
import {
  listInput,
  listBoundary,
  listResult,
} from "../../../../shared/http/list-page";
import { formatCredit } from "../../domain/money";
import { parseAbsoluteTimestamp } from "../../../../shared/time/timestamp.policy";

/** Admin scheduling and reports require an explicit timezone, independent of server TZ. */
export function feeTimestamp(value: string) {
  try {
    return parseAbsoluteTimestamp(value);
  } catch {
    throw new BadRequestException("INVALID_FEE_TIMESTAMP");
  }
}

@Injectable()
export class FeePolicyAdminService {
  constructor(
    private readonly transactions: TransactionRunner,
    private readonly sessions: SessionsService,
    private readonly reauth: ReauthProofService,
    private readonly audit: AuditService,
  ) {}
  private async authorize(
    tx: TransactionContext,
    actor: Principal,
    permission = "fee-policy:manage",
  ) {
    const live = await this.sessions.assertLive(tx, actor);
    if (!live.roles.includes("ADMIN") || !live.permissions.includes(permission))
      throw new ForbiddenException("FEE_ADMIN_REQUIRED");
    return live;
  }
  list(actor: Principal, query: { limit?: number; cursor?: string }) {
    const scope = JSON.stringify(["fee-policies-v1", actor.userId]),
      { limit, cursor } = listInput(query, scope);
    return this.transactions.run(async (tx) => {
      await this.authorize(tx, actor);
      const now = await databaseNow(tx);
      const rows = await tx.feePolicyVersion.findMany({
        where: listBoundary("createdAt", cursor),
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: limit + 1,
      });
      const effectivePolicies = await tx.feePolicyVersion.findMany({
        where: {
          status: "APPROVED",
          approvedAt: { not: null },
          effectiveAt: { lte: now },
        },
        orderBy: [{ effectiveAt: "desc" }, { versionNo: "desc" }],
        distinct: ["policyCode"],
        select: { id: true },
      });
      const effectiveIds = new Set(effectivePolicies.map((row) => row.id));
      const page = listResult(rows, limit, scope, (row) => row.createdAt);
      return {
        ...page,
        data: page.data.map((row) => ({
          ...row,
          effective: effectiveIds.has(row.id),
        })),
      };
    });
  }
  create(
    actor: Principal,
    input: {
      versionNo: number;
      feeBps: number;
      reason: string;
      reauthToken: string;
    },
  ) {
    const reason = validateReason(input.reason, { min: 3, max: 1000 });
    if (
      !Number.isSafeInteger(input.versionNo) ||
      input.versionNo < 1 ||
      !Number.isInteger(input.feeBps) ||
      input.feeBps < 0 ||
      input.feeBps >= 10000
    )
      throw new BadRequestException("INVALID_MATERIAL_FEE_POLICY");
    return this.transactions.run(async (tx) => {
      await this.authorize(tx, actor);
      await lockUsers(tx, [actor.userId]);
      const live = await this.authorize(tx, actor);
      // One policy-series lock serializes explicit version allocation across Admins.
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended('fee-policy:MATERIAL_PAID', 0))`;
      const latest = await tx.feePolicyVersion.findFirst({
        where: { policyCode: "MATERIAL_PAID" },
        orderBy: { versionNo: "desc" },
      });
      if (input.versionNo !== (latest?.versionNo ?? 0) + 1)
        throw new ConflictException("STALE_FEE_POLICY_VERSION");
      await this.reauth.consumeReauth(tx, live, input.reauthToken);
      const result = await tx.feePolicyVersion.create({
        data: {
          policyCode: "MATERIAL_PAID",
          versionNo: input.versionNo,
          calculationRule: { feeBps: input.feeBps },
          roundingRule: { mode: "DOWN", precision: 2 },
          status: "DRAFT",
          createdBy: live.userId,
        },
      });
      await this.audit.append(tx, {
        actorId: live.userId,
        actorRole: "ADMIN",
        action: "MATERIAL_FEE_POLICY_CREATE",
        targetType: "FeePolicyVersion",
        targetId: result.id,
        reason,
        after: { feeBps: input.feeBps, versionNo: result.versionNo },
      });
      return result;
    });
  }
  approve(
    actor: Principal,
    id: string,
    input: { reason: string; reauthToken: string; effectiveAt?: string },
  ) {
    const reason = validateReason(input.reason, { min: 3, max: 1000 });
    return this.transactions.run(async (tx) => {
      await this.authorize(tx, actor);
      await lockUsers(tx, [actor.userId]);
      const live = await this.authorize(tx, actor);
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended('fee-policy:MATERIAL_PAID', 0))`;
      const row = await tx.feePolicyVersion.findUnique({ where: { id } });
      if (!row) throw new NotFoundException("FEE_POLICY_NOT_FOUND");
      if (row.policyCode !== "MATERIAL_PAID")
        throw new ForbiddenException("LEARNING_FEE_FIXED_AT_FOUR_PERCENT");
      if (row.status !== "DRAFT")
        throw new ConflictException("FEE_POLICY_ALREADY_DECIDED");
      const now = await databaseNow(tx),
        effectiveAt = input.effectiveAt ? feeTimestamp(input.effectiveAt) : now;
      if (!Number.isFinite(+effectiveAt) || effectiveAt < now)
        throw new BadRequestException("FEE_POLICY_EFFECTIVE_TIME_IN_PAST");
      const active = await tx.feePolicyVersion.findFirst({
        where: {
          policyCode: "MATERIAL_PAID",
          status: "APPROVED",
          approvedAt: { not: null },
          effectiveAt: { not: null },
        },
        orderBy: { effectiveAt: "desc" },
      });
      if (
        active?.effectiveAt &&
        (effectiveAt <= active.effectiveAt || row.versionNo <= active.versionNo)
      )
        throw new ConflictException("FEE_POLICY_EFFECTIVE_ORDER_CONFLICT");
      await this.reauth.consumeReauth(tx, live, input.reauthToken);
      const result = await tx.feePolicyVersion.update({
        where: { id },
        data: {
          status: "APPROVED",
          approvedAt: now,
          approvedByUserId: live.userId,
          effectiveAt,
        },
      });
      await this.audit.append(tx, {
        actorId: live.userId,
        actorRole: "ADMIN",
        action: "MATERIAL_FEE_POLICY_APPROVE",
        targetType: "FeePolicyVersion",
        targetId: id,
        reason,
        after: {
          versionNo: row.versionNo,
          effectiveAt: effectiveAt.toISOString(),
        },
      });
      return result;
    });
  }
  revenue(
    actor: Principal,
    input: { from: string; to: string; granularity: "day" | "month" },
  ) {
    const from = feeTimestamp(input.from),
      to = feeTimestamp(input.to);
    if (
      !Number.isFinite(+from) ||
      !Number.isFinite(+to) ||
      to <= from ||
      +to - +from > 366 * 86400000 ||
      !["day", "month"].includes(input.granularity)
    )
      throw new BadRequestException("INVALID_FEE_REPORT_RANGE");
    return this.transactions.run(async (tx) => {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      await this.authorize(tx, actor, "credit:read:any");
      const rows = await tx.$queryRaw<
        {
          period: string;
          business: string;
          collected: bigint;
          refunded: bigint;
        }[]
      >`
        WITH events AS (
          SELECT t.created_at AS at, o.operation_type AS business, t.amount::numeric AS collected, 0::numeric AS refunded
          FROM credit_transactions t JOIN credit_operations o ON o.operation_id=t.operation_id
          WHERE t.type='PLATFORM_FEE' AND t.status='SUCCESS' AND o.status='SUCCESS'
          UNION ALL
          SELECT o.created_at AS at, 'MATERIAL_PURCHASE' AS business, 0::numeric AS collected,
            SUM(t.available_delta::numeric) AS refunded
          FROM credit_operations o JOIN credit_transactions t ON t.operation_id=o.operation_id
          WHERE o.operation_type='MATERIAL_REFUND' AND o.status='SUCCESS' AND t.status='SUCCESS'
          GROUP BY o.operation_id, o.created_at
        )
        SELECT to_char(date_trunc(${input.granularity}::text, at AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS period,
          business, SUM(collected)::bigint AS collected, SUM(refunded)::bigint AS refunded
        FROM events WHERE at >= ${from} AND at < ${to}
        GROUP BY 1, 2 ORDER BY 1, 2
      `;
      return {
        from,
        to,
        timezone: "UTC",
        granularity: input.granularity,
        basis: "RECORDED_CREDIT_FEES_AND_MATERIAL_REFUNDS",
        items: rows.map((row) => ({
          period: row.period,
          business: row.business,
          collectedCredit: formatCredit(row.collected),
          refundedCredit: formatCredit(row.refunded),
          netCredit: formatCredit(row.collected - row.refunded),
        })),
      };
    });
  }
}
