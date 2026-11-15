import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type {
  MaterialReview,
  Prisma,
} from "../../../../generated/prisma/client";
import { TransactionRunner } from "../../../../infrastructure/database/transaction-runner";
import {
  listBoundary,
  listInput,
  listResult,
} from "../../../../shared/http/list-page";
import { AuditWriter } from "../../../audit/application/services/audit-writer";
import type { Principal } from "../../../auth/application/services/sessions.service";
import { SkillActorService } from "../../../users/application/services/skill-actor.service";
import { auditContext, lockMaterial, roleCodes } from "./material-support";
import { recomputeMaterialRatingSummary } from "./material-rating-summary.service";

@Injectable()
export class MaterialReviewModerationService {
  constructor(
    private readonly transactions: TransactionRunner,
    private readonly actors: SkillActorService,
    private readonly audit: AuditWriter,
  ) {}

  async queue(
    principal: Principal,
    status: "REPORTED" | "HIDDEN" | undefined,
    query: { limit?: number; cursor?: string },
  ) {
    requireReviewModerator(principal);
    const selected = status ?? "REPORTED";
    const scope = JSON.stringify(["staff-material-reviews-v1", selected]);
    const { limit, cursor } = listInput(query, scope);
    const where: Prisma.MaterialReviewWhereInput = {
      deletedAt: null,
      ...(selected === "HIDDEN"
        ? { status: "HIDDEN" }
        : { reports: { some: { status: "OPEN" } } }),
      ...listBoundary("createdAt", cursor),
    };
    return this.transactions.run(async (tx) => {
      const rows = await tx.materialReview.findMany({
        where,
        include: {
          materialIdRecord: { select: { title: true, ownerId: true } },
          reports: {
            where: { status: "OPEN" },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            select: {
              id: true,
              reasonCode: true,
              description: true,
              createdAt: true,
            },
          },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: limit + 1,
      });
      const page = listResult(rows, limit, scope, (row) => row.createdAt);
      const owners = await this.actors.readPublicOwners(
        tx,
        page.data.map((row) => row.authorId),
      );
      const ownerById = new Map(owners.map((owner) => [owner.id, owner]));
      return {
        ...page,
        data: page.data.map((row) => ({
          id: row.id,
          material: {
            id: row.materialId,
            title: row.materialIdRecord.title,
            ownerId: row.materialIdRecord.ownerId,
          },
          reviewer: ownerById.get(row.authorId) ?? {
            id: row.authorId,
            displayName: "SkillHub user",
            avatarUrl: null,
          },
          rating: row.rating,
          comment: row.comment,
          status: row.status,
          version: row.version,
          reports: row.reports,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        })),
      };
    });
  }

  moderate(
    principal: Principal,
    reviewId: string,
    action: "hide" | "restore",
    input: { expectedVersion: number; reason: string },
  ) {
    requireReviewModerator(principal);
    const reason = input.reason.trim();
    if (!reason || reason.length > 2_000)
      throw new BadRequestException("MATERIAL_REVIEW_REASON_REQUIRED");
    return this.transactions.run(async (tx) => {
      const snapshot = await tx.materialReview.findUnique({
        where: { id: reviewId },
      });
      if (!snapshot || snapshot.deletedAt)
        throw new NotFoundException("MATERIAL_REVIEW_NOT_FOUND");
      await lockMaterial(tx, snapshot.materialId);
      await tx.$queryRaw`SELECT review_id FROM material_reviews WHERE review_id = ${reviewId}::uuid FOR UPDATE`;
      const current = await tx.materialReview.findUniqueOrThrow({
        where: { id: reviewId },
      });
      if (current.deletedAt)
        throw new NotFoundException("MATERIAL_REVIEW_NOT_FOUND");
      if (current.version !== input.expectedVersion)
        throw new ConflictException("MATERIAL_REVIEW_VERSION_CONFLICT");
      const desired = action === "hide" ? "HIDDEN" : "VISIBLE";
      if (
        (action === "hide" && current.status !== "VISIBLE") ||
        (action === "restore" && current.status !== "HIDDEN")
      )
        throw new ConflictException("MATERIAL_REVIEW_TRANSITION_INVALID");
      const updated = await tx.materialReview.update({
        where: { id: reviewId },
        data: { status: desired, version: { increment: 1 } },
      });
      if (action === "hide") {
        await tx.materialReviewReport.updateMany({
          where: { reviewId, status: "OPEN" },
          data: {
            status: "RESOLVED",
            resolvedById: principal.userId,
            resolvedAt: new Date(),
            decisionReason: reason,
          },
        });
      }
      await recomputeMaterialRatingSummary(tx, current.materialId);
      await this.audit.append(tx, {
        actor: {
          kind: "HUMAN",
          userId: principal.userId,
          roles: roleCodes(principal),
        },
        action: "MATERIAL_REVIEW_MODERATE",
        target: { type: "MATERIAL_REVIEW", id: reviewId },
        before: auditView(current),
        after: auditView(updated),
        reason,
        context: auditContext(),
      });
      await tx.outboxEvent.create({
        data: {
          aggregateType: "MATERIAL_REVIEW",
          aggregateId: reviewId,
          version: updated.version,
          type:
            action === "hide"
              ? "material.review.hidden"
              : "material.review.restored",
          payload: {
            reviewId,
            materialId: current.materialId,
            authorId: current.authorId,
          },
          dedupeKey: `material-review-${action}:${reviewId}:${updated.version}`,
          correlationId: randomUUID(),
        },
      });
      return {
        id: updated.id,
        materialId: updated.materialId,
        status: updated.status,
        version: updated.version,
        updatedAt: updated.updatedAt,
      };
    });
  }

  async dismissReports(
    principal: Principal,
    reviewId: string,
    input: { expectedVersion: number; reason: string },
  ) {
    requireReviewModerator(principal);
    const reason = input.reason.trim();
    if (!reason || reason.length > 2_000)
      throw new BadRequestException("MATERIAL_REVIEW_REASON_REQUIRED");
    return this.transactions.run(async (tx) => {
      await tx.$queryRaw`SELECT review_id FROM material_reviews WHERE review_id = ${reviewId}::uuid FOR UPDATE`;
      const review = await tx.materialReview.findUnique({
        where: { id: reviewId },
      });
      if (!review || review.deletedAt)
        throw new NotFoundException("MATERIAL_REVIEW_NOT_FOUND");
      if (review.version !== input.expectedVersion)
        throw new ConflictException("MATERIAL_REVIEW_VERSION_CONFLICT");
      if (review.status !== "VISIBLE")
        throw new ConflictException("MATERIAL_REVIEW_TRANSITION_INVALID");
      const reports = await tx.materialReviewReport.findMany({
        where: { reviewId, status: "OPEN" },
        select: { id: true },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      });
      if (reports.length === 0)
        throw new ConflictException("MATERIAL_REVIEW_NO_OPEN_REPORTS");
      const resolvedAt = new Date();
      await tx.materialReviewReport.updateMany({
        where: {
          id: { in: reports.map((report) => report.id) },
          status: "OPEN",
        },
        data: {
          status: "RESOLVED",
          resolvedById: principal.userId,
          resolvedAt,
          decisionReason: reason,
        },
      });
      await Promise.all(
        reports.map((report) =>
          this.audit.append(tx, {
            actor: {
              kind: "HUMAN",
              userId: principal.userId,
              roles: roleCodes(principal),
            },
            action: "MATERIAL_REVIEW_REPORT",
            target: { type: "MATERIAL_REVIEW_REPORT", id: report.id },
            before: { reviewId, status: "OPEN" },
            after: { reviewId, status: "RESOLVED" },
            reason,
            context: auditContext(),
          }),
        ),
      );
      return {
        reviewId,
        reviewStatus: review.status,
        resolvedReportCount: reports.length,
        resolvedAt,
        resolvedById: principal.userId,
      };
    });
  }
}

function requireReviewModerator(principal: Principal) {
  if (
    !principal.permissions.includes("material-review:moderate") ||
    (!principal.roles.includes("STAFF") && !principal.roles.includes("ADMIN"))
  )
    throw new ForbiddenException("STAFF_ACCESS_REQUIRED");
}

function auditView(review: MaterialReview) {
  return {
    materialId: review.materialId,
    rating: review.rating,
    status: review.status as "VISIBLE" | "HIDDEN",
    version: review.version,
    deleted: review.deletedAt !== null,
  };
}
