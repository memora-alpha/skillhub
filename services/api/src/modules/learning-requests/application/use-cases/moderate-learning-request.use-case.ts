import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Inject,
  NotFoundException,
} from "@nestjs/common";
import { lockUsers } from "../../../../shared/database/identity-transactions";
import type { RoleCode } from "../../../../shared/authorization/authorization.types";
import type { RequestContext } from "../../../../shared/http/request-context";
import { TransactionRunner } from "../../../../infrastructure/database/transaction-runner";
import { OutboxWriter } from "../../../../infrastructure/events/outbox-writer";
import type { Principal } from "../../../auth/application/services/sessions.service";
import { AuditWriter } from "../../../audit/application/services/audit-writer";
import type { AuditActor } from "../../../audit/application/contracts/audit.types";
import { validateReason } from "../../../audit/domain/reason.policy";
import { sanitizeLearningRequestText } from "../../domain/request-text.policy";
import {
  toLearningRequestModerationDetail,
  type LearningRequestModerationDetail,
} from "../contracts/learning-request.types";
import type { LearningRequestRejectedEvent } from "../contracts/learning-request-rejection.event";
import {
  LEARNING_REQUEST_REPOSITORY,
  type LearningRequestRepository,
} from "../ports/learning-request-repository";
import { LearningRequestAccessService } from "../services/learning-request-access.service";
import {
  SHARING_SKILL_READER,
  type SharingSkillReader,
} from "../ports/learning-request-dependencies";

export type ModerationDecision = "APPROVE" | "REJECT";
export type ModerationCommand = { expectedVersion: number; reason: string };

const roleCodes = new Set<RoleCode>(["USER", "STAFF", "ADMIN"]);
const reviewerRoles = new Set<RoleCode>(["STAFF", "ADMIN"]);

function prepareReason(decision: ModerationDecision, value: unknown): string {
  if (typeof value !== "string")
    throw new BadRequestException("INVALID_MODERATION_INPUT");
  const text = sanitizeLearningRequestText(value);
  return validateReason(
    text,
    decision === "REJECT" ? { min: 10, max: 500 } : { min: 1, max: 2000 },
  );
}

function assertExpectedVersion(value: number): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new BadRequestException("INVALID_MODERATION_INPUT");
  }
}

function auditActor(principal: Principal): AuditActor {
  const roles = principal.roles.filter((role): role is RoleCode =>
    roleCodes.has(role as RoleCode),
  );
  if (roles.length === 0) throw new ForbiddenException();
  return { kind: "HUMAN", userId: principal.userId, roles };
}

@Injectable()
export class ModerateLearningRequestUseCase {
  constructor(
    private readonly transactions: TransactionRunner,
    private readonly access: LearningRequestAccessService,
    @Inject(LEARNING_REQUEST_REPOSITORY)
    private readonly repository: LearningRequestRepository,
    private readonly audit: AuditWriter,
    private readonly outbox: OutboxWriter,
    @Inject(SHARING_SKILL_READER) private readonly sharing: SharingSkillReader,
  ) {}

  async execute(
    actor: Principal,
    requestId: string,
    decision: ModerationDecision,
    input: ModerationCommand,
    context: RequestContext,
  ): Promise<LearningRequestModerationDetail> {
    if (decision !== "APPROVE" && decision !== "REJECT") {
      throw new BadRequestException("INVALID_MODERATION_INPUT");
    }
    assertExpectedVersion(input.expectedVersion);
    const reason = prepareReason(decision, input.reason);
    // Keep the event identity stable if TransactionRunner retries a database conflict.
    const eventId = decision === "REJECT" ? randomUUID() : undefined;
    const permission =
      decision === "APPROVE"
        ? "learning-request:approve"
        : "learning-request:reject";

    return this.transactions.run(async (tx) => {
      await lockUsers(tx, [actor.userId]);
      const live = await this.access.assertAction(tx, actor, permission);
      if (!live.roles.some((role) => reviewerRoles.has(role as RoleCode))) {
        throw new ForbiddenException();
      }

      const request = await this.repository.lock(tx, requestId);
      if (!request) throw new NotFoundException();
      const now = await this.repository.databaseNow(tx);
      if (
        request.status !== "PENDING_MODERATION" ||
        request.moderationStatus !== "PENDING" ||
        request.version !== input.expectedVersion ||
        (request.expiresAt !== null && request.expiresAt <= now)
      ) {
        throw new ConflictException("REQUEST_VERSION_CONFLICT");
      }
      const reviewed = { ...request };

      const moderationStatus = decision === "APPROVE" ? "APPROVED" : "REJECTED";
      const transition = {
        status: decision === "APPROVE" ? "OPEN" : "REJECTED",
        moderationStatus,
        moderationRejectReason: decision === "REJECT" ? reason : null,
        moderationReviewedVersion: input.expectedVersion,
        moderatedByUserId: live.userId,
        moderatedAt: now,
      } as const;
      const auditInput = this.audit.validate({
        actor: auditActor(live),
        action: "LEARNING_REQUEST_MODERATE",
        target: { type: "LEARNING_REQUEST", id: request.id },
        before: { status: "PENDING", requestVersion: request.version },
        after: {
          status: moderationStatus,
          requestVersion: request.version + 1,
        },
        reason,
        context,
      });

      const written = await this.repository.transition(
        tx,
        request.id,
        input.expectedVersion,
        ["PENDING_MODERATION"],
        transition,
      );
      if (!written) throw new ConflictException("REQUEST_VERSION_CONFLICT");
      await this.audit.append(tx, auditInput);

      if (decision === "REJECT" && eventId) {
        const event: LearningRequestRejectedEvent = {
          eventId,
          type: "learning-request.rejected",
          version: 1,
          correlationId: context.correlationId,
          payload: {
            requestId: request.id,
            ownerId: request.ownerId,
            reviewedVersion: reviewed.version,
            decisionVersion: reviewed.version + 1,
            rejectReason: reason,
          },
        };
        await this.outbox.append(tx, event);
      }

      const offeringIds = (reviewed.offeringLinks ?? []).map(
        (link) => link.sharingSkillId,
      );
      return toLearningRequestModerationDetail(
        {
          ...reviewed,
          ...transition,
          version: reviewed.version + 1,
          updatedAt: now,
        },
        offeringIds.length
          ? await this.sharing.readRequestOfferings(tx, offeringIds)
          : [],
      );
    });
  }
}
