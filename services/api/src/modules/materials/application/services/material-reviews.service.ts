import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { queueReportText } from "../../../reports/application/services/report-content-moderation";
import type {
  Material,
  MaterialReview,
} from "../../../../generated/prisma/client";
import { TransactionRunner } from "../../../../infrastructure/database/transaction-runner";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import { IdempotencyService } from "../../../../infrastructure/idempotency/idempotency.service";
import type { JsonValue } from "../../../../infrastructure/idempotency/idempotency.types";
import {
  listBoundary,
  listInput,
  listResult,
} from "../../../../shared/http/list-page";
import { AuditWriter } from "../../../audit/application/services/audit-writer";
import type { Principal } from "../../../auth/application/services/sessions.service";
import { SkillActorService } from "../../../users/application/services/skill-actor.service";
import {
  ContentModerationService,
  requireAllowed,
} from "../../../content-moderation/application/content-moderation.service";
import {
  reviewComment,
  reviewRating,
  type MaterialReviewEligibilityReason,
} from "../../domain/material-review.policy";
import {
  auditContext,
  lockMaterial,
  requirePermission,
  roleCodes,
} from "./material-support";
import {
  materialRatingSummaryView,
  recomputeMaterialRatingSummary,
} from "./material-rating-summary.service";

type ReviewEligibility = {
  canReview: boolean;
  reasonCode: MaterialReviewEligibilityReason | null;
  canEdit: boolean;
  editReasonCode: MaterialReviewEditReason | null;
  currentReview: MaterialReview | null;
  eligibilitySource: "FREE_ACCESS" | "PAID_ENTITLEMENT" | null;
  sourceOrderId: string | null;
};

type MaterialReviewEditReason =
  MaterialReviewEligibilityReason | "MATERIAL_REVIEW_NOT_FOUND";

@Injectable()
export class MaterialReviewsService {
  constructor(
    private readonly transactions: TransactionRunner,
    private readonly idempotency: IdempotencyService,
    private readonly actors: SkillActorService,
    private readonly audit: AuditWriter,
    private readonly moderation?: ContentModerationService,
  ) {}

  async list(materialId: string, query: { limit?: number; cursor?: string }) {
    const scope = JSON.stringify(["material-reviews-v1", materialId]);
    const { limit, cursor } = listInput(query, scope);
    if (limit > 50) throw new BadRequestException("INVALID_PAGE_LIMIT");
    return this.transactions.run(async (tx) => {
      const material = await tx.material.findFirst({
        where: { id: materialId, status: "PUBLISHED", scanStatus: "CLEAN" },
        select: { id: true },
      });
      if (!material) throw new NotFoundException("MATERIAL_NOT_FOUND");
      const rows = await tx.materialReview.findMany({
        where: {
          materialId,
          status: "VISIBLE",
          deletedAt: null,
          ...listBoundary("createdAt", cursor),
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: limit + 1,
      });
      const page = listResult(rows, limit, scope, (row) => row.createdAt);
      const authorIds = page.data.map((row) => row.authorId);
      const [owners, entitlements, summary] = await Promise.all([
        this.actors.readPublicOwners(tx, authorIds),
        tx.materialEntitlement.findMany({
          where: {
            materialId,
            userId: { in: authorIds },
            status: "ACTIVE",
            sourceType: "PURCHASE",
          },
          select: { userId: true },
        }),
        tx.materialRatingSummary.findUnique({ where: { materialId } }),
      ]);
      const ownerById = new Map(owners.map((owner) => [owner.id, owner]));
      const verified = new Set(entitlements.map((row) => row.userId));
      return {
        data: page.data.map((row) =>
          publicReviewView(
            row,
            ownerById.get(row.authorId),
            verified.has(row.authorId),
          ),
        ),
        pagination: page.pagination,
        summary: materialRatingSummaryView(summary),
      };
    });
  }

  async eligibility(principal: Principal, materialId: string) {
    requirePermission(principal, "material:access");
    return this.transactions.run(async (tx) => {
      const material = await tx.material.findUnique({
        where: { id: materialId },
      });
      if (!material) throw new NotFoundException("MATERIAL_NOT_FOUND");
      const result = await this.evaluate(tx, principal.userId, material);
      return eligibilityView(result);
    });
  }

  async create(
    principal: Principal,
    materialId: string,
    input: { rating: number; comment?: string },
    key: string | undefined,
  ) {
    requirePermission(principal, "material:access");
    const idempotencyKey = key?.trim();
    if (!idempotencyKey)
      throw new BadRequestException("IDEMPOTENCY_KEY_REQUIRED");
    const rating = reviewRating(input.rating);
    const comment = reviewComment(input.comment);
    const command = { materialId, rating, comment } satisfies JsonValue;
    let checked = false;
    let hidden = false;
    const moderation = this.moderation;
    const moderateComment = comment && moderation;
    if (
      moderateComment &&
      (await this.eligibility(principal, materialId)).canReview
    ) {
      const assessment = await moderation.evaluateText(
        "material_review",
        "submission",
        [comment],
      );
      hidden = assessment.outcome === "REVIEW";
      if (!hidden) requireAllowed(assessment);
      checked = true;
    }
    const result = await this.idempotency.execute(
      {
        scope: `material-review:${principal.userId}`,
        operation: "create",
        key: idempotencyKey,
        command,
      },
      async (tx) => {
        await lockReviewIdentity(tx, materialId, principal.userId);
        const material = await lockMaterial(tx, materialId);
        await lockReviewEligibilitySource(tx, principal.userId, material);
        const eligibility = await this.evaluate(tx, principal.userId, material);
        if (!eligibility.canReview)
          throw new ConflictException({
            message: "MATERIAL_REVIEW_NOT_ALLOWED",
            reason: eligibility.reasonCode,
          });
        if (moderateComment && !checked)
          throw new ConflictException("MATERIAL_REVIEW_ELIGIBILITY_CHANGED");
        let review: MaterialReview;
        try {
          review = await tx.materialReview.create({
            data: {
              id: randomUUID(),
              materialId,
              authorId: principal.userId,
              rating,
              comment,
              status: hidden ? "HIDDEN" : "VISIBLE",
              eligibilitySource: eligibility.eligibilitySource!,
              sourceOrderId: eligibility.sourceOrderId,
            },
          });
        } catch (error) {
          rethrowReviewUnique(error);
        }
        if (!hidden) await recomputeMaterialRatingSummary(tx, materialId);
        await this.auditReview(
          tx,
          principal,
          "MATERIAL_REVIEW_CREATE",
          review,
          "Material review created",
        );
        if (!hidden)
          await reviewEvent(
            tx,
            review,
            "material.review.created",
            material.ownerId,
          );
        return {
          id: review.id,
          status: review.status,
          version: review.version,
        };
      },
    );
    const review = await this.readOwn(result.value.id, principal.userId);
    return { review, replayed: result.replayed };
  }

  async update(
    principal: Principal,
    reviewId: string,
    input: {
      expectedVersion: number;
      rating?: number;
      comment?: string | null;
    },
  ) {
    requirePermission(principal, "material:access");
    if (input.rating === undefined && input.comment === undefined)
      throw new BadRequestException("MATERIAL_REVIEW_UPDATE_EMPTY");
    const rating =
      input.rating === undefined ? undefined : reviewRating(input.rating);
    const comment =
      input.comment === undefined ? undefined : reviewComment(input.comment);
    if (comment && this.moderation) {
      await this.transactions.run(async (tx) => {
        const current = await tx.materialReview.findUnique({
          where: { id: reviewId },
        });
        if (
          !current ||
          current.authorId !== principal.userId ||
          current.deletedAt
        )
          throw new NotFoundException("MATERIAL_REVIEW_NOT_FOUND");
        if (current.status === "HIDDEN")
          throw new ConflictException("MATERIAL_REVIEW_HIDDEN");
        if (current.version !== input.expectedVersion)
          throw new ConflictException("MATERIAL_REVIEW_VERSION_CONFLICT");
      });
      requireAllowed(
        await this.moderation.evaluateText(
          "material_review",
          String(input.expectedVersion),
          [comment],
        ),
      );
    }
    return this.transactions.run(async (tx) => {
      const snapshot = await tx.materialReview.findUnique({
        where: { id: reviewId },
      });
      if (
        !snapshot ||
        snapshot.authorId !== principal.userId ||
        snapshot.deletedAt
      )
        throw new NotFoundException("MATERIAL_REVIEW_NOT_FOUND");
      const material = await lockMaterial(tx, snapshot.materialId);
      await lockReview(tx, reviewId);
      const current = await tx.materialReview.findUniqueOrThrow({
        where: { id: reviewId },
      });
      if (current.authorId !== principal.userId || current.deletedAt)
        throw new NotFoundException("MATERIAL_REVIEW_NOT_FOUND");
      if (current.status === "HIDDEN")
        throw new ConflictException("MATERIAL_REVIEW_HIDDEN");
      await assertReviewStillEditable(tx, current, material);
      if (current.version !== input.expectedVersion)
        throw new ConflictException("MATERIAL_REVIEW_VERSION_CONFLICT");
      const updated = await tx.materialReview.update({
        where: { id: reviewId },
        data: {
          ...(rating === undefined ? {} : { rating }),
          ...(comment === undefined ? {} : { comment }),
          version: { increment: 1 },
        },
      });
      await recomputeMaterialRatingSummary(tx, current.materialId);
      await this.auditReview(
        tx,
        principal,
        "MATERIAL_REVIEW_UPDATE",
        updated,
        "Material review updated",
      );
      await reviewEvent(tx, updated, "material.review.updated");
      return ownReviewView(updated);
    });
  }

  async remove(
    principal: Principal,
    reviewId: string,
    expectedVersion: number,
  ) {
    requirePermission(principal, "material:access");
    if (!Number.isInteger(expectedVersion) || expectedVersion < 1)
      throw new BadRequestException("MATERIAL_REVIEW_VERSION_INVALID");
    return this.transactions.run(async (tx) => {
      const snapshot = await tx.materialReview.findUnique({
        where: { id: reviewId },
      });
      if (!snapshot || snapshot.authorId !== principal.userId)
        throw new NotFoundException("MATERIAL_REVIEW_NOT_FOUND");
      await lockMaterial(tx, snapshot.materialId);
      await lockReview(tx, reviewId);
      const current = await tx.materialReview.findUniqueOrThrow({
        where: { id: reviewId },
      });
      if (current.deletedAt)
        return { review: ownReviewView(current), replayed: true };
      if (current.version !== expectedVersion)
        throw new ConflictException("MATERIAL_REVIEW_VERSION_CONFLICT");
      await tx.materialReviewReport.updateMany({
        where: { reviewId, status: "OPEN" },
        data: {
          status: "RESOLVED",
          resolvedById: principal.userId,
          resolvedAt: new Date(),
          decisionReason: "Review deleted by its author",
        },
      });
      const deleted = await tx.materialReview.update({
        where: { id: reviewId },
        data: { deletedAt: new Date(), version: { increment: 1 } },
      });
      await recomputeMaterialRatingSummary(tx, current.materialId);
      await this.auditReview(
        tx,
        principal,
        "MATERIAL_REVIEW_DELETE",
        deleted,
        "Material review deleted",
      );
      await reviewEvent(tx, deleted, "material.review.deleted");
      return { review: ownReviewView(deleted), replayed: false };
    });
  }

  async report(
    principal: Principal,
    reviewId: string,
    input: { reasonCode: string; description: string },
  ) {
    requirePermission(principal, "material:access");
    const description = input.description.trim();
    if (description.length < 10 || description.length > 2_000)
      throw new BadRequestException("MATERIAL_REVIEW_REASON_REQUIRED");
    return this.transactions.run(async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${`material-review-report:${reviewId}:${principal.userId}`}, 0))`;
      const review = await tx.materialReview.findUnique({
        where: { id: reviewId },
      });
      if (!review || review.deletedAt || review.status !== "VISIBLE")
        throw new NotFoundException("MATERIAL_REVIEW_NOT_FOUND");
      if (review.authorId === principal.userId)
        throw new ForbiddenException("MATERIAL_REVIEW_SELF_REPORT_FORBIDDEN");
      const existing = await tx.materialReviewReport.findFirst({
        where: { reviewId, reporterId: principal.userId, status: "OPEN" },
      });
      if (existing)
        throw new ConflictException("MATERIAL_REVIEW_REPORT_EXISTS");
      const report = await tx.materialReviewReport.create({
        data: {
          id: randomUUID(),
          reviewId,
          reporterId: principal.userId,
          reasonCode: input.reasonCode,
          description,
          status: "OPEN",
        },
      });
      await queueReportText(tx, this.moderation, {
        kind: "MATERIAL_REVIEW_REPORT",
        sourceId: report.id,
        text: description,
      });
      await this.audit.append(tx, {
        actor: {
          kind: "HUMAN",
          userId: principal.userId,
          roles: roleCodes(principal),
        },
        action: "MATERIAL_REVIEW_REPORT",
        target: { type: "MATERIAL_REVIEW_REPORT", id: report.id },
        after: { reviewId, status: "OPEN" },
        reason: "Material review report submitted",
        context: auditContext(),
      });
      await tx.outboxEvent.create({
        data: {
          aggregateType: "MATERIAL_REVIEW_REPORT",
          aggregateId: report.id,
          version: 1,
          type: "material.review.reported",
          payload: {
            reportId: report.id,
            reviewId,
            materialId: review.materialId,
          },
          dedupeKey: `material-review-reported:${report.id}`,
          correlationId: randomUUID(),
        },
      });
      return {
        id: report.id,
        reviewId,
        status: report.status,
        createdAt: report.createdAt,
      };
    });
  }

  private async readOwn(reviewId: string, authorId: string) {
    return this.transactions.run(async (tx) => {
      const review = await tx.materialReview.findUnique({
        where: { id: reviewId },
      });
      if (!review || review.authorId !== authorId)
        throw new NotFoundException("MATERIAL_REVIEW_NOT_FOUND");
      return ownReviewView(review);
    });
  }

  private async evaluate(
    tx: TransactionContext,
    userId: string,
    material: Material,
  ): Promise<ReviewEligibility> {
    const currentReview = await tx.materialReview.findFirst({
      where: { materialId: material.id, authorId: userId, deletedAt: null },
    });
    if (currentReview) {
      const editability = await evaluateReviewEditability(
        tx,
        currentReview,
        material,
      );
      return {
        canReview: false,
        reasonCode:
          currentReview.status === "HIDDEN"
            ? "MATERIAL_REVIEW_HIDDEN"
            : "MATERIAL_REVIEW_ALREADY_EXISTS",
        canEdit: editability.canEdit,
        editReasonCode: editability.reasonCode,
        currentReview,
        eligibilitySource: null,
        sourceOrderId: null,
      };
    }
    if (material.status !== "PUBLISHED")
      return blocked("MATERIAL_NOT_PUBLISHED", null);
    if (material.ownerId === userId)
      return blocked("MATERIAL_OWNER_CANNOT_REVIEW", null);
    if (material.accessType === "FREE") {
      const grant = await tx.materialDownloadGrant.findFirst({
        where: {
          materialId: material.id,
          requestedBy: userId,
          accessSource: "FREE_PUBLIC",
          status: "ISSUED",
        },
        select: { id: true },
      });
      return grant
        ? allowed("FREE_ACCESS", null)
        : blocked("MATERIAL_ACCESS_REQUIRED", null);
    }
    const entitlement = await tx.materialEntitlement.findUnique({
      where: { userId_materialId: { userId, materialId: material.id } },
      select: { status: true, sourceOrderId: true },
    });
    if (!entitlement) return blocked("MATERIAL_PURCHASE_REQUIRED", null);
    if (entitlement.status !== "ACTIVE" || !entitlement.sourceOrderId)
      return blocked("MATERIAL_ENTITLEMENT_REVOKED", null);
    return allowed("PAID_ENTITLEMENT", entitlement.sourceOrderId);
  }

  private auditReview(
    tx: TransactionContext,
    principal: Principal,
    action:
      | "MATERIAL_REVIEW_CREATE"
      | "MATERIAL_REVIEW_UPDATE"
      | "MATERIAL_REVIEW_DELETE",
    review: MaterialReview,
    reason: string,
  ) {
    return this.audit.append(tx, {
      actor: {
        kind: "HUMAN",
        userId: principal.userId,
        roles: roleCodes(principal),
      },
      action,
      target: { type: "MATERIAL_REVIEW", id: review.id },
      after: reviewAuditView(review),
      reason,
      context: auditContext(),
    });
  }
}

async function assertReviewStillEditable(
  tx: TransactionContext,
  review: MaterialReview,
  material: Material,
) {
  const editability = await evaluateReviewEditability(tx, review, material);
  if (!editability.canEdit)
    throw new ConflictException({
      message: "MATERIAL_REVIEW_NOT_ALLOWED",
      reason: editability.reasonCode,
    });
}

async function evaluateReviewEditability(
  tx: TransactionContext,
  review: MaterialReview,
  material: Material,
): Promise<{ canEdit: boolean; reasonCode: MaterialReviewEditReason | null }> {
  if (review.status === "HIDDEN")
    return { canEdit: false, reasonCode: "MATERIAL_REVIEW_HIDDEN" };
  if (material.status !== "PUBLISHED")
    return { canEdit: false, reasonCode: "MATERIAL_NOT_PUBLISHED" };
  if (material.ownerId === review.authorId)
    return { canEdit: false, reasonCode: "MATERIAL_OWNER_CANNOT_REVIEW" };
  if (material.accessType === "FREE") {
    const grant = await tx.materialDownloadGrant.findFirst({
      where: {
        materialId: review.materialId,
        requestedBy: review.authorId,
        accessSource: "FREE_PUBLIC",
        status: "ISSUED",
      },
      select: { id: true },
    });
    return grant
      ? { canEdit: true, reasonCode: null }
      : { canEdit: false, reasonCode: "MATERIAL_ACCESS_REQUIRED" };
  }
  const entitlement = await tx.materialEntitlement.findUnique({
    where: {
      userId_materialId: {
        userId: review.authorId,
        materialId: review.materialId,
      },
    },
    select: { status: true, sourceOrderId: true },
  });
  if (!entitlement)
    return { canEdit: false, reasonCode: "MATERIAL_PURCHASE_REQUIRED" };
  if (entitlement.status !== "ACTIVE" || !entitlement.sourceOrderId)
    return { canEdit: false, reasonCode: "MATERIAL_ENTITLEMENT_REVOKED" };
  return { canEdit: true, reasonCode: null };
}

function blocked(
  reasonCode: MaterialReviewEligibilityReason,
  currentReview: MaterialReview | null,
): ReviewEligibility {
  return {
    canReview: false,
    reasonCode,
    canEdit: false,
    editReasonCode: currentReview ? reasonCode : "MATERIAL_REVIEW_NOT_FOUND",
    currentReview,
    eligibilitySource: null,
    sourceOrderId: null,
  };
}

function allowed(
  eligibilitySource: "FREE_ACCESS" | "PAID_ENTITLEMENT",
  sourceOrderId: string | null,
): ReviewEligibility {
  return {
    canReview: true,
    reasonCode: null,
    canEdit: false,
    editReasonCode: "MATERIAL_REVIEW_NOT_FOUND",
    currentReview: null,
    eligibilitySource,
    sourceOrderId,
  };
}

function eligibilityView(result: ReviewEligibility) {
  return {
    canReview: result.canReview,
    reasonCode: result.reasonCode,
    canEdit: result.canEdit,
    editReasonCode: result.editReasonCode,
    currentReview: result.currentReview
      ? ownReviewView(result.currentReview)
      : null,
  };
}

function ownReviewView(review: MaterialReview) {
  return {
    id: review.id,
    materialId: review.materialId,
    rating: review.rating,
    comment: review.comment,
    status: review.status,
    version: review.version,
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
    deletedAt: review.deletedAt,
  };
}

function publicReviewView(
  review: MaterialReview,
  reviewer:
    { id: string; displayName: string; avatarUrl: string | null } | undefined,
  verifiedPurchase: boolean,
) {
  return {
    id: review.id,
    reviewer: {
      userId: review.authorId,
      fullName: reviewer?.displayName ?? "SkillHub user",
      avatarUrl: reviewer?.avatarUrl ?? null,
    },
    rating: review.rating,
    comment: review.comment,
    status: review.status,
    verifiedPurchase,
    version: review.version,
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
  };
}

function reviewAuditView(review: MaterialReview) {
  return {
    materialId: review.materialId,
    rating: review.rating,
    status: review.status as "VISIBLE" | "HIDDEN",
    version: review.version,
    deleted: review.deletedAt !== null,
  };
}

async function lockReviewIdentity(
  tx: TransactionContext,
  materialId: string,
  userId: string,
) {
  const key = `material-review:${materialId}:${userId}`;
  await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
}

async function lockReview(tx: TransactionContext, reviewId: string) {
  await tx.$queryRaw`SELECT review_id FROM material_reviews WHERE review_id = ${reviewId}::uuid FOR UPDATE`;
}

async function lockReviewEligibilitySource(
  tx: TransactionContext,
  userId: string,
  material: Material,
) {
  if (material.accessType === "FREE") {
    await tx.$queryRaw`SELECT grant_id FROM material_download_grants
      WHERE material_id = ${material.id}::uuid
        AND requested_by = ${userId}::uuid
        AND access_source = 'FREE_PUBLIC'
        AND status = 'ISSUED'
      ORDER BY grant_id
      FOR UPDATE`;
    return;
  }
  await tx.$queryRaw`SELECT entitlement_id FROM material_entitlements
    WHERE user_id = ${userId}::uuid AND material_id = ${material.id}::uuid
    FOR UPDATE`;
}

function rethrowReviewUnique(error: unknown): never {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "P2002"
  )
    throw new ConflictException("MATERIAL_REVIEW_EXISTS");
  throw error;
}

async function reviewEvent(
  tx: TransactionContext,
  review: MaterialReview,
  type:
    | "material.review.created"
    | "material.review.updated"
    | "material.review.deleted",
  ownerId?: string,
) {
  await tx.outboxEvent.create({
    data: {
      aggregateType: "MATERIAL_REVIEW",
      aggregateId: review.id,
      version: review.version,
      type,
      payload: {
        reviewId: review.id,
        materialId: review.materialId,
        authorId: review.authorId,
        ...(ownerId ? { ownerId } : {}),
      },
      dedupeKey: `${type}:${review.id}:${review.version}`,
      correlationId: randomUUID(),
    },
  });
}
