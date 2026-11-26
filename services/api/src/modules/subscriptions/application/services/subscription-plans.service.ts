import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  Prisma,
  SubscriptionPlanVersion,
} from "../../../../generated/prisma/client";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import { TransactionRunner } from "../../../../infrastructure/database/transaction-runner";
import {
  listBoundary,
  listInput,
  listResult,
} from "../../../../shared/http/list-page";
import { AuditWriter } from "../../../audit/application/services/audit-writer";
import type { Principal } from "../../../auth/application/services/sessions.service";
import {
  parsePlanEntitlements,
  SUBSCRIPTION_PLAN_CODES,
  type SubscriptionPlanCode,
} from "../../domain/plan-entitlements";
import {
  adminPlanVersionView,
  auditContext,
  databaseNow,
  humanActor,
  lockKey,
  planAudit,
  planVersionView,
  requireSubscriptionPermission,
} from "./subscription-support";

type PlanStatus = SubscriptionPlanVersion["status"];

/** Spec 021 D5: versioned plan prices and entitlements, managed like fee policies. */
@Injectable()
export class SubscriptionPlansService {
  constructor(
    private readonly transactions: TransactionRunner,
    private readonly audit: AuditWriter,
  ) {}

  /**
   * The effective approved version of a plan at `at`: latest `effectiveAt <= at`, ties
   * broken by version number. Retired versions are never effective.
   */
  effectiveVersion(
    tx: TransactionContext,
    planCode: SubscriptionPlanCode,
    at: Date,
  ): Promise<SubscriptionPlanVersion | null> {
    return tx.subscriptionPlanVersion.findFirst({
      where: {
        planCode,
        status: "APPROVED",
        effectiveAt: { lte: at },
      },
      orderBy: [{ effectiveAt: "desc" }, { versionNo: "desc" }],
    });
  }

  async listEffective() {
    return this.transactions.run(async (tx) => {
      const now = await databaseNow(tx);
      const versions = await Promise.all(
        SUBSCRIPTION_PLAN_CODES.map((code) =>
          this.effectiveVersion(tx, code, now),
        ),
      );
      return versions
        .filter((version): version is SubscriptionPlanVersion => !!version)
        .map(planVersionView);
    });
  }

  async adminList(
    principal: Principal,
    query: {
      planCode?: SubscriptionPlanCode;
      status?: PlanStatus;
      limit?: number;
      cursor?: string;
    },
  ) {
    requireSubscriptionPermission(principal, "subscription:read");
    const scope = "admin-subscription-plans";
    const { limit, cursor } = listInput(query, scope);
    const rows = await this.transactions.run((tx) =>
      tx.subscriptionPlanVersion.findMany({
        where: {
          planCode: query.planCode,
          status: query.status,
          ...listBoundary("createdAt", cursor),
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: limit + 1,
      }),
    );
    const page = listResult(rows, limit, scope, (row) => row.createdAt);
    return {
      data: page.data.map(adminPlanVersionView),
      pagination: page.pagination,
    };
  }

  async create(
    principal: Principal,
    input: {
      planCode: SubscriptionPlanCode;
      monthPrice: bigint;
      yearPrice: bigint;
      entitlements: unknown;
      reason: string;
    },
  ) {
    requireSubscriptionPermission(principal, "subscription:manage");
    if (input.monthPrice <= 0n || input.yearPrice <= 0n)
      throw new BadRequestException("INVALID_SUBSCRIPTION_PRICE");
    let entitlements;
    try {
      entitlements = parsePlanEntitlements(input.entitlements);
    } catch {
      throw new BadRequestException("INVALID_SUBSCRIPTION_ENTITLEMENTS");
    }
    // The fee tier of a plan is the plan itself (D8).
    if (entitlements.feeTier !== input.planCode)
      throw new BadRequestException("INVALID_SUBSCRIPTION_ENTITLEMENTS");
    return this.transactions.run(async (tx) => {
      await lockKey(tx, `subscription-plan:${input.planCode}`);
      const latest = await tx.subscriptionPlanVersion.findFirst({
        where: { planCode: input.planCode },
        orderBy: { versionNo: "desc" },
        select: { versionNo: true },
      });
      const created = await tx.subscriptionPlanVersion.create({
        data: {
          planCode: input.planCode,
          versionNo: (latest?.versionNo ?? 0) + 1,
          monthPrice: input.monthPrice,
          yearPrice: input.yearPrice,
          entitlements: entitlements as Prisma.InputJsonObject,
          status: "DRAFT",
          createdByUserId: principal.userId,
        },
      });
      await this.audit.append(tx, {
        actor: humanActor(principal),
        action: "SUBSCRIPTION_PLAN_CREATE",
        target: { type: "SUBSCRIPTION_PLAN_VERSION", id: created.id },
        after: planAudit(created),
        reason: input.reason,
        context: auditContext(),
      });
      return adminPlanVersionView(created);
    });
  }

  async approve(
    principal: Principal,
    id: string,
    input: { effectiveAt: Date; reason: string },
  ) {
    requireSubscriptionPermission(principal, "subscription:manage");
    if (!Number.isFinite(input.effectiveAt.getTime()))
      throw new BadRequestException("INVALID_EFFECTIVE_AT");
    return this.transition(principal, id, "DRAFT", input.reason, (now) => {
      if (input.effectiveAt < now)
        throw new BadRequestException("INVALID_EFFECTIVE_AT");
      return {
        status: "APPROVED",
        effectiveAt: input.effectiveAt,
        approvedAt: now,
        approvedByUserId: principal.userId,
      };
    });
  }

  async retire(principal: Principal, id: string, input: { reason: string }) {
    requireSubscriptionPermission(principal, "subscription:manage");
    return this.transition(principal, id, "APPROVED", input.reason, () => ({
      status: "RETIRED",
    }));
  }

  private transition(
    principal: Principal,
    id: string,
    from: PlanStatus,
    reason: string,
    change: (
      now: Date,
    ) => Prisma.SubscriptionPlanVersionUncheckedUpdateManyInput,
  ) {
    return this.transactions.run(async (tx) => {
      const before = await tx.subscriptionPlanVersion.findUnique({
        where: { id },
      });
      if (!before) throw new NotFoundException("SUBSCRIPTION_PLAN_NOT_FOUND");
      await lockKey(tx, `subscription-plan:${before.planCode}`);
      const now = await databaseNow(tx);
      const updated = await tx.subscriptionPlanVersion.updateMany({
        where: { id, status: from },
        data: change(now),
      });
      if (updated.count !== 1)
        throw new ConflictException("SUBSCRIPTION_PLAN_STATE_CONFLICT");
      const after = await tx.subscriptionPlanVersion.findUniqueOrThrow({
        where: { id },
      });
      await this.audit.append(tx, {
        actor: humanActor(principal),
        action:
          after.status === "APPROVED"
            ? "SUBSCRIPTION_PLAN_APPROVE"
            : "SUBSCRIPTION_PLAN_RETIRE",
        target: { type: "SUBSCRIPTION_PLAN_VERSION", id },
        before: planAudit(before),
        after: planAudit(after),
        reason,
        context: auditContext(),
      });
      return adminPlanVersionView(after);
    });
  }
}
