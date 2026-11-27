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
import { readRecordedCreditFees } from "./fee-revenue.reader";
import { formatCredit } from "../../domain/money";
import { parseAbsoluteTimestamp } from "../../../../shared/time/timestamp.policy";
import { SystemConfigurationService } from "../../../system-configuration/application/services/system-configuration.service";
import { randomUUID } from "node:crypto";
import {
  baseFeePolicyCode,
  isFeePolicyCode,
  type FeePolicyCode,
} from "../../domain/fee-policy-codes";

export const MIN_FEE_POLICY_BPS = 100;
export const MAX_FEE_POLICY_BPS = 1_000;

/** Material series store `feeBps` only; learning series also store the returned share. */
function feeCalculationRule(policyCode: FeePolicyCode, feeBps: number) {
  return isMaterialSeries(policyCode)
    ? { feeBps }
    : { returnedBps: 10_000 - feeBps, feeBps };
}

const isMaterialSeries = (policyCode: string) =>
  baseFeePolicyCode(policyCode) === "MATERIAL_PAID";

function feeBpsFromRule(value: unknown): number {
  const feeBps = (value as { feeBps?: unknown } | null)?.feeBps;
  if (
    !Number.isInteger(feeBps) ||
    (feeBps as number) < 0 ||
    (feeBps as number) >= 10_000
  )
    throw new ConflictException("FEE_POLICY_INVALID");
  return feeBps as number;
}

function validBusinessFeeBps(value: number) {
  return (
    Number.isInteger(value) &&
    value >= MIN_FEE_POLICY_BPS &&
    value <= MAX_FEE_POLICY_BPS
  );
}

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
    private readonly configuration: SystemConfigurationService,
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
  nextVersion(actor: Principal, policyCode: FeePolicyCode) {
    if (!isFeePolicyCode(policyCode))
      throw new BadRequestException("INVALID_FEE_POLICY");
    return this.transactions.run(async (tx) => {
      await this.authorize(tx, actor);
      const latest = await tx.feePolicyVersion.findFirst({
        where: { policyCode },
        orderBy: { versionNo: "desc" },
        select: { versionNo: true },
      });
      return { policyCode, nextVersion: (latest?.versionNo ?? 0) + 1 };
    });
  }
  current(actor: Principal) {
    return this.transactions.run(async (tx) => {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      await this.authorize(tx, actor);
      const now = await databaseNow(tx);
      const rows = await tx.feePolicyVersion.findMany({
        where: {
          status: "APPROVED",
          approvedAt: { not: null },
          effectiveAt: { lte: now },
        },
        orderBy: [{ effectiveAt: "desc" }, { versionNo: "desc" }],
        distinct: ["policyCode"],
      });
      return rows.map((row) => ({ ...row, effective: true }));
    });
  }
  creditPolicy(actor: Principal) {
    return this.transactions.run(async (tx) => {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      await this.authorize(tx, actor, "credit:read:any");
      const snapshot = await this.configuration.getSnapshot(
        ["credit.topUpVndPerCredit", "learningPath.minCreditPerUser"],
        tx,
      );
      const policies = await tx.feePolicyVersion.findMany({
        where: {
          policyCode: { in: ["ONE_WAY", "TWO_WAY"] },
          status: "APPROVED",
          approvedAt: { not: null },
          effectiveAt: { lte: snapshot.readAt },
        },
        orderBy: [{ effectiveAt: "desc" }, { versionNo: "desc" }],
        distinct: ["policyCode"],
      });
      return {
        topUpVndPerCredit: snapshot.values["credit.topUpVndPerCredit"],
        minCreditPerUser: snapshot.values["learningPath.minCreditPerUser"],
        withdrawalsSupported: false,
        policies: policies.map((row) => ({ ...row, effective: true })),
        versions: snapshot.versions,
        readAt: snapshot.readAt,
      };
    });
  }
  create(
    actor: Principal,
    input: {
      policyCode?: FeePolicyCode;
      versionNo: number;
      feeBps: number;
      reason: string;
      reauthToken: string;
    },
  ) {
    const reason = validateReason(input.reason, { min: 3, max: 1000 });
    const policyCode = input.policyCode ?? "MATERIAL_PAID";
    if (
      !isFeePolicyCode(policyCode) ||
      !Number.isSafeInteger(input.versionNo) ||
      input.versionNo < 1 ||
      !validBusinessFeeBps(input.feeBps)
    )
      throw new BadRequestException("INVALID_FEE_POLICY");
    return this.transactions.run(async (tx) => {
      await this.authorize(tx, actor);
      await lockUsers(tx, [actor.userId]);
      const live = await this.authorize(tx, actor);
      // One policy-series lock serializes explicit version allocation across Admins.
      const lockKey = `fee-policy:${policyCode}`;
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
      const latest = await tx.feePolicyVersion.findFirst({
        where: { policyCode },
        orderBy: { versionNo: "desc" },
      });
      if (input.versionNo !== (latest?.versionNo ?? 0) + 1)
        throw new ConflictException("STALE_FEE_POLICY_VERSION");
      await this.reauth.consumeReauth(tx, live, input.reauthToken);
      const result = await tx.feePolicyVersion.create({
        data: {
          policyCode,
          versionNo: input.versionNo,
          calculationRule: feeCalculationRule(policyCode, input.feeBps),
          roundingRule: { mode: "DOWN", precision: 2 },
          status: "DRAFT",
          createdBy: live.userId,
        },
      });
      await this.audit.append(tx, {
        actorId: live.userId,
        actorRole: "ADMIN",
        action: isMaterialSeries(policyCode)
          ? "MATERIAL_FEE_POLICY_CREATE"
          : "LEARNING_FEE_POLICY_CREATE",
        targetType: "FeePolicyVersion",
        targetId: result.id,
        reason,
        after: {
          policyCode,
          feeBps: input.feeBps,
          versionNo: result.versionNo,
        },
      });
      return result;
    });
  }
  updateDraft(
    actor: Principal,
    id: string,
    input: { feeBps: number; reason: string; reauthToken: string },
  ) {
    if (!validBusinessFeeBps(input.feeBps))
      throw new BadRequestException("INVALID_FEE_POLICY");
    const reason = validateReason(input.reason, { min: 3, max: 1000 });
    return this.transactions.run(async (tx) => {
      await this.authorize(tx, actor);
      await lockUsers(tx, [actor.userId]);
      const live = await this.authorize(tx, actor);
      let row = await tx.feePolicyVersion.findUnique({ where: { id } });
      if (!row) throw new NotFoundException("FEE_POLICY_NOT_FOUND");
      const lockKey = `fee-policy:${row.policyCode}`;
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
      row = await tx.feePolicyVersion.findUnique({ where: { id } });
      if (!row) throw new NotFoundException("FEE_POLICY_NOT_FOUND");
      if (row.status !== "DRAFT")
        throw new ConflictException("FEE_POLICY_ALREADY_DECIDED");
      const previousFeeBps = feeBpsFromRule(row.calculationRule);
      await this.reauth.consumeReauth(tx, live, input.reauthToken);
      const result = await tx.feePolicyVersion.update({
        where: { id },
        data: {
          calculationRule: feeCalculationRule(row.policyCode, input.feeBps),
        },
      });
      await this.audit.append(tx, {
        actorId: live.userId,
        actorRole: "ADMIN",
        action: isMaterialSeries(row.policyCode)
          ? "MATERIAL_FEE_POLICY_UPDATE"
          : "LEARNING_FEE_POLICY_UPDATE",
        targetType: "FeePolicyVersion",
        targetId: id,
        reason,
        before: {
          policyCode: row.policyCode,
          feeBps: previousFeeBps,
          versionNo: row.versionNo,
        },
        after: {
          policyCode: row.policyCode,
          feeBps: input.feeBps,
          versionNo: row.versionNo,
        },
      });
      return result;
    });
  }
  deleteDraft(
    actor: Principal,
    id: string,
    input: { reason: string; reauthToken: string },
  ) {
    const reason = validateReason(input.reason, { min: 3, max: 1000 });
    return this.transactions.run(async (tx) => {
      await this.authorize(tx, actor);
      await lockUsers(tx, [actor.userId]);
      const live = await this.authorize(tx, actor);
      let row = await tx.feePolicyVersion.findUnique({ where: { id } });
      if (!row) throw new NotFoundException("FEE_POLICY_NOT_FOUND");
      const lockKey = `fee-policy:${row.policyCode}`;
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
      row = await tx.feePolicyVersion.findUnique({ where: { id } });
      if (!row) throw new NotFoundException("FEE_POLICY_NOT_FOUND");
      if (row.status !== "DRAFT")
        throw new ConflictException("FEE_POLICY_ALREADY_DECIDED");
      const feeBps = feeBpsFromRule(row.calculationRule);
      await this.reauth.consumeReauth(tx, live, input.reauthToken);
      const deleted = await tx.feePolicyVersion.deleteMany({
        where: { id, status: "DRAFT" },
      });
      if (deleted.count !== 1)
        throw new ConflictException("FEE_POLICY_ALREADY_DECIDED");
      await this.audit.append(tx, {
        actorId: live.userId,
        actorRole: "ADMIN",
        action: isMaterialSeries(row.policyCode)
          ? "MATERIAL_FEE_POLICY_DELETE"
          : "LEARNING_FEE_POLICY_DELETE",
        targetType: "FeePolicyVersion",
        targetId: id,
        reason,
        before: {
          policyCode: row.policyCode,
          feeBps,
          versionNo: row.versionNo,
          status: row.status,
        },
        after: { status: "DELETED" },
      });
      return {
        id,
        policyCode: row.policyCode,
        versionNo: row.versionNo,
        status: "DELETED" as const,
      };
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
      let row = await tx.feePolicyVersion.findUnique({ where: { id } });
      if (!row) throw new NotFoundException("FEE_POLICY_NOT_FOUND");
      const lockKey = `fee-policy:${row.policyCode}`;
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
      row = await tx.feePolicyVersion.findUnique({ where: { id } });
      if (!row) throw new NotFoundException("FEE_POLICY_NOT_FOUND");
      if (row.status !== "DRAFT")
        throw new ConflictException("FEE_POLICY_ALREADY_DECIDED");
      const now = await databaseNow(tx),
        effectiveAt = input.effectiveAt ? feeTimestamp(input.effectiveAt) : now;
      if (!Number.isFinite(+effectiveAt) || effectiveAt < now)
        throw new BadRequestException("FEE_POLICY_EFFECTIVE_TIME_IN_PAST");
      const latestApprovedVersion = await tx.feePolicyVersion.findFirst({
        where: {
          policyCode: row.policyCode,
          status: "APPROVED",
          approvedAt: { not: null },
          effectiveAt: { not: null },
        },
        orderBy: { versionNo: "desc" },
      });
      if (
        latestApprovedVersion &&
        row.versionNo <= latestApprovedVersion.versionNo
      )
        throw new ConflictException("FEE_POLICY_EFFECTIVE_ORDER_CONFLICT");
      const feeBps = feeBpsFromRule(row.calculationRule);
      if (!validBusinessFeeBps(feeBps))
        throw new BadRequestException("INVALID_FEE_POLICY");
      const previousEffective = await tx.feePolicyVersion.findFirst({
        where: {
          id: { not: row.id },
          policyCode: row.policyCode,
          status: "APPROVED",
          approvedAt: { not: null },
          effectiveAt: { lte: effectiveAt },
        },
        orderBy: [{ effectiveAt: "desc" }, { versionNo: "desc" }],
      });
      const previousFeeBps = previousEffective
        ? feeBpsFromRule(previousEffective.calculationRule)
        : null;
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
        action: isMaterialSeries(row.policyCode)
          ? "MATERIAL_FEE_POLICY_APPROVE"
          : "LEARNING_FEE_POLICY_APPROVE",
        targetType: "FeePolicyVersion",
        targetId: id,
        reason,
        after: {
          policyCode: row.policyCode,
          versionNo: row.versionNo,
          effectiveAt: effectiveAt.toISOString(),
        },
      });
      const correlationId = randomUUID();
      const payload = {
        policyId: id,
        policyCode: row.policyCode,
        versionNo: row.versionNo,
        feeBps,
        ...(previousFeeBps === null ? {} : { previousFeeBps }),
        effectiveAt: effectiveAt.toISOString(),
      };
      await tx.outboxEvent.create({
        data: {
          aggregateType: "FEE_POLICY",
          aggregateId: id,
          version: row.versionNo,
          type: "admin.fee-policy.approved",
          payload: { ...payload, approvedByUserId: live.userId },
          dedupeKey: `fee-policy-approved:${id}`,
          correlationId,
          availableAt: now,
        },
      });
      await tx.outboxEvent.create({
        data: {
          aggregateType: "FEE_POLICY",
          aggregateId: id,
          version: row.versionNo,
          type: "credit.fee-policy.effective",
          payload,
          dedupeKey: `fee-policy-effective:${id}`,
          correlationId,
          availableAt: effectiveAt,
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
      const rows = await readRecordedCreditFees(tx, {
        from,
        to,
        timezone: "UTC",
        granularity: input.granularity,
      });
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
