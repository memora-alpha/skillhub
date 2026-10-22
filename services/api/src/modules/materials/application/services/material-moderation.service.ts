import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { TransactionRunner } from "../../../../infrastructure/database/transaction-runner";
import { AuditWriter } from "../../../audit/application/services/audit-writer";
import type { Principal } from "../../../auth/application/services/sessions.service";
import {
  assertPublishableFile,
  moderationTransition,
  type MaterialState,
  type ModerationAction,
} from "../../domain/material.policy";
import { ownerMaterialView } from "../contracts/material-view";
import {
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
  ) {}

  // Async so the moderator check surfaces as a promise rejection, never a sync throw.
  async queue(principal: Principal, status: MaterialState = "PENDING_REVIEW") {
    requireModerator(principal);
    return this.transactions.run(async (tx) => {
      // ponytail: oldest 100 first; paginate when the queue grows past it.
      const rows = await tx.material.findMany({
        where: { status },
        orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
        take: 100,
      });
      return rows.map(ownerMaterialView);
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
      if (next.status === "PUBLISHED") assertPublishableFile(current);
      const updated = await tx.material.update({
        where: { id },
        data: {
          status: next.status,
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
