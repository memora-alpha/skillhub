import {
  listInput,
  listBoundary,
  listResult,
} from "../../../../shared/http/list-page";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { TransactionRunner } from "../../../../infrastructure/database/transaction-runner";
import { AuditWriter } from "../../../audit/application/services/audit-writer";
import { AuditReader } from "../../../audit/application/services/audit-reader";
import type { Principal } from "../../../auth/application/services/sessions.service";
import {
  moderationTransition,
  STAFF_MATERIAL_STATES,
  type MaterialState,
  type ModerationAction,
} from "../../domain/material.policy";
import { ownerMaterialView } from "../contracts/material-view";
import {
  materialFilterScope,
  materialListWhere,
  type MaterialListFilters,
} from "./material-list-filters";
import {
  assertReadyMaterialFile,
  auditContext,
  lockMaterial,
  requireModerator,
  roleCodes,
} from "./material-support";

@Injectable()
export class MaterialModerationService {
  constructor(
    private readonly transactions: TransactionRunner,
    private readonly audit: AuditWriter,
    private readonly auditReader: AuditReader,
  ) {}

  /** Read-only Staff/Admin projection; no arbitrary audit snapshots leave this API. */
  async history(
    principal: Principal,
    id: string,
    query: { limit?: number; cursor?: string } = {},
  ) {
    requireModerator(principal);
    const material = await this.transactions.run((tx) =>
      tx.material.findUnique({ where: { id }, select: { id: true } }),
    );
    if (!material) throw new NotFoundException("MATERIAL_NOT_FOUND");
    const result = await this.auditReader.readTarget({
      ...query,
      targetType: "MATERIAL",
      targetId: id,
      action: "MATERIAL_MODERATE",
    });
    return {
      ...result,
      data: result.data.map((row) => {
        const before = moderationSnapshot(row.before);
        const after = moderationSnapshot(row.after);
        return {
          id: row.id,
          action: historyAction(
            before.status,
            after.status,
            after.moderationAction,
          ),
          actor: {
            kind: row.actorKind,
            userId: row.actorId,
            roles: row.actorRoles,
            systemActor: row.systemActor ?? null,
          },
          occurredAt: row.createdAt,
          reason: row.reason,
          previousStatus: before.status,
          status: after.status,
          reviewedListingVersion: before.listingVersion,
          listingVersion: after.listingVersion,
        };
      }),
    };
  }

  // Async so the moderator check surfaces as a promise rejection, never a sync throw.
  async queue(
    principal: Principal,
    status: MaterialState | "ALL" = "PENDING_REVIEW",
    query: MaterialListFilters & { limit?: number; cursor?: string } = {},
  ) {
    requireModerator(principal);
    const filters = materialListWhere(query);
    const scope = JSON.stringify([
      "materials-staff-v1",
      principal.userId,
      status,
      ...materialFilterScope(query),
    ]);
    const { limit, cursor } = listInput(query, scope);
    return this.transactions.run(async (tx) => {
      const rows = await tx.material.findMany({
        where: {
          status:
            status === "ALL" ? { in: [...STAFF_MATERIAL_STATES] } : status,
          ...filters,
          ...listBoundary("updatedAt", cursor, true),
        },
        orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
        take: limit + 1,
      });
      const result = listResult(rows, limit, scope, (row) => row.updatedAt);
      return { ...result, data: result.data.map(ownerMaterialView) };
    });
  }

  /**
   * FR-MAT-06: every decision that changes access carries a reason and an audit row.
   * The decision applies only to the listing version the moderator reviewed.
   */
  async moderate(
    principal: Principal,
    id: string,
    action: ModerationAction,
    input: { expectedListingVersion: number; reason?: string },
  ) {
    requireModerator(principal);
    const defaultNote = action === "approve" ? "Material approved" : "";
    const note = input.reason?.trim() || defaultNote;
    if (!note) throw new BadRequestException("MATERIAL_REASON_REQUIRED");
    return this.transactions.run(async (tx) => {
      const current = await lockMaterial(tx, id);
      const publishes = action === "approve" || action === "unhide";
      if (publishes && current.ownerId === principal.userId)
        throw new ForbiddenException("MATERIAL_SELF_REVIEW_FORBIDDEN");
      if (current.listingVersion !== input.expectedListingVersion)
        throw new ConflictException("MATERIAL_VERSION_CONFLICT");
      const next = moderationTransition(action, current.status);
      if (next.status === "PUBLISHED")
        await assertReadyMaterialFile(tx, current);
      const updated = await tx.material.update({
        where: { id },
        data: {
          status: next.status,
          listingVersion: { increment: 1 },
          ...(next.status === "PUBLISHED" ? { hasBeenPublished: true } : {}),
          moderationStatus: next.decision,
          reviewedByUserId: principal.userId,
          reviewedAt: new Date(),
          ...(action === "reject" ? { rejectReason: note } : {}),
        },
      });
      await this.audit.append(tx, {
        actor: {
          kind: "HUMAN",
          userId: principal.userId,
          roles: roleCodes(principal),
        },
        action: "MATERIAL_MODERATE",
        target: { type: "MATERIAL", id },
        before: {
          status: current.status,
          listingVersion: current.listingVersion,
        },
        after: {
          status: updated.status,
          listingVersion: updated.listingVersion,
        },
        reason: note,
        context: auditContext(),
      });
      await tx.outboxEvent.create({
        data: {
          aggregateType: "MATERIAL",
          aggregateId: id,
          version: updated.listingVersion,
          type: "material.moderated",
          payload: {
            materialId: id,
            ownerId: updated.ownerId,
            action,
            status: updated.status,
          },
          dedupeKey: `material-moderated:${id}:${updated.updatedAt.toISOString()}`,
          correlationId: randomUUID(),
        },
      });
      return ownerMaterialView(updated);
    });
  }
}

function moderationSnapshot(value: unknown) {
  const record =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  return {
    status: typeof record.status === "string" ? record.status : null,
    listingVersion:
      typeof record.listingVersion === "number" &&
      Number.isSafeInteger(record.listingVersion)
        ? record.listingVersion
        : null,
    moderationAction:
      typeof record.moderationAction === "string"
        ? record.moderationAction
        : null,
  };
}

function historyAction(
  before: string | null,
  after: string | null,
  explicit: string | null,
): string {
  if (explicit && ["approve", "reject", "hide", "unhide"].includes(explicit))
    return explicit;
  if (after === "REJECTED") return "reject";
  if (after === "HIDDEN") return "hide";
  if (after === "PUBLISHED" && before === "HIDDEN") return "unhide";
  if (after === "PUBLISHED" && before === "PENDING_REVIEW") return "approve";
  return "unknown";
}
