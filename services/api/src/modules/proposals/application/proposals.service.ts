import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../../../infrastructure/database/prisma.service";
import { TransactionRunner } from "../../../infrastructure/database/transaction-runner";
import type { TransactionContext } from "../../../infrastructure/database/transaction-context";
import { IdempotencyService } from "../../../infrastructure/idempotency/idempotency.service";
import type { Principal } from "../../auth/application/services/sessions.service";
import { SkillActorService } from "../../users/application/services/skill-actor.service";
import { SharingSkillsService } from "../../sharing-skills/application/sharing-skills.service";
import { LearningRequestLifecycleService } from "../../learning-requests/application/services/learning-request-lifecycle.service";
import { ApplicationEventsService } from "../../application-events/application/application-events.service";
import {
  commandJson,
  type SkillCommand,
} from "../../skills/application/skill-contracts";
import type {
  Prisma,
  Proposal,
  ProposalStatus,
} from "../../../generated/prisma/client";
import { ConnectionConfig } from "../domain/connection-config";
import {
  normalizeProposal,
  formatCredit,
  type ProposalHints,
} from "../domain/connection-policy";
import {
  cursorScope,
  readCursor,
  page,
} from "../../skills/domain/skill-policy";
import { AuditWriter } from "../../audit/application/audit-writer";
import { auditActorFromActor } from "../../audit/application/audit.types";
import { ConversationLifecycleService } from "../../conversations/application/conversation-lifecycle.service";
import { conversationView } from "../../conversations/domain/conversation-view";
import { ConnectionNotificationService } from "../../notifications/application/services/connection-notification.service";

export type CreateProposal = ProposalHints & {
  sourceType: "LEARNING_REQUEST" | "DIRECT_SEARCH";
  learningRequestId?: string;
  recipientSharingSkillId?: string;
};
export function proposalView(row: Proposal, conversationId?: string) {
  const { requestId, proposedCredit, ...rest } = row;
  const privateFields = new Set(["targetSharingSkillId", "terminalAt"]);
  const publicFields = Object.fromEntries(
    Object.entries(rest).filter(([key]) => !privateFields.has(key)),
  ) as Omit<typeof rest, "targetSharingSkillId" | "terminalAt">;
  return {
    ...publicFields,
    learningRequestId: requestId,
    proposedCredit: formatCredit(proposedCredit),
    ...(conversationId ? { conversationId } : {}),
  };
}
@Injectable()
export class ProposalsService {
  constructor(
    private readonly db: PrismaService,
    private readonly transactions: TransactionRunner,
    private readonly commands: IdempotencyService,
    private readonly actors: SkillActorService,
    private readonly sharing: SharingSkillsService,
    private readonly requests: LearningRequestLifecycleService,
    private readonly events: ApplicationEventsService,
    private readonly config: ConnectionConfig,
    private readonly audit: AuditWriter,
    private readonly conversations: ConversationLifecycleService,
    private readonly notifications: ConnectionNotificationService,
  ) {}
  private async parties(
    tx: TransactionContext,
    principal: Principal,
    row: Pick<Proposal, "proposerId" | "recipientId">,
    permission: string,
  ) {
    if (![row.proposerId, row.recipientId].includes(principal.userId))
      throw new NotFoundException();
    await this.actors.require(tx, principal, permission, [
      row.proposerId,
      row.recipientId,
    ]);
  }
  private async raw(tx: TransactionContext, id: string, lock = false) {
    if (lock)
      await tx.$queryRaw`SELECT proposal_id FROM proposals WHERE proposal_id=${id}::uuid FOR UPDATE`;
    const row = await tx.proposal.findUnique({ where: { id } });
    if (!row) throw new NotFoundException();
    return row;
  }
  private async clock(tx: TransactionContext) {
    const rows = await tx.$queryRaw<
      { now: Date }[]
    >`SELECT clock_timestamp() AS now`;
    return rows[0]!.now;
  }
  async get(principal: Principal, id: string) {
    return this.transactions.run(async (tx) => {
      const row = await this.raw(tx, id);
      await this.parties(tx, principal, row, "proposal:read:party");
      const conversation = await this.conversations.readForProposal(tx, id);
      return proposalView(row, conversation?.id);
    });
  }
  async list(
    principal: Principal,
    query: {
      direction?: "sent" | "received";
      status?: ProposalStatus;
      learningRequestId?: string;
      cursor?: string;
      limit?: number;
    },
  ) {
    const limit = query.limit ?? 20,
      scope = cursorScope({
        type: "proposals",
        viewer: principal.userId,
        direction: query.direction ?? "received",
        status: query.status ?? null,
        requestId: query.learningRequestId ?? null,
      }),
      cursor = readCursor(query.cursor, scope);
    return this.transactions.run(async (tx) => {
      await this.actors.require(tx, principal, "proposal:read:party");
      if (query.learningRequestId) {
        const request = await this.requests.proposalSource(
          tx,
          query.learningRequestId,
        );
        if (request.ownerId !== principal.userId) throw new NotFoundException();
      }
      const rows = await tx.proposal.findMany({
        where: {
          ...(query.direction === "sent"
            ? { proposerId: principal.userId }
            : { recipientId: principal.userId }),
          ...(query.status ? { status: query.status } : {}),
          ...(query.learningRequestId
            ? { requestId: query.learningRequestId }
            : {}),
          ...(cursor ? { id: { gt: cursor.id } } : {}),
        },
        orderBy: { id: "asc" },
        take: limit + 1,
      });
      const result = page(rows, limit, scope, (row) => row.id);
      return { ...result, data: result.data.map((row) => proposalView(row)) };
    });
  }
  async create(command: SkillCommand, input: CreateProposal) {
    if (
      (input.sourceType === "LEARNING_REQUEST" &&
        (!input.learningRequestId ||
          input.recipientSharingSkillId !== undefined)) ||
      (input.sourceType === "DIRECT_SEARCH" &&
        (!input.recipientSharingSkillId ||
          input.learningRequestId !== undefined))
    )
      throw new BadRequestException("INVALID_PROPOSAL_SOURCE");
    // Discovery is read-only. Every source and identity is checked again under ordered locks.
    const source =
      input.sourceType === "LEARNING_REQUEST"
        ? await this.requests.proposalSource(this.db, input.learningRequestId!)
        : await this.sharing.read(input.recipientSharingSkillId!, this.db);
    if (!source) throw new NotFoundException();
    const recipientId = "ownerId" in source ? source.ownerId : source.userId;
    if (recipientId === command.principal.userId)
      throw new ConflictException("SELF_PROPOSAL");
    const authorize = async (tx: TransactionContext) => {
      await this.actors.require(tx, command.principal, "proposal:create", [
        recipientId,
      ]);
      await this.actors.assertConnectionParty(tx, recipientId);
    };
    try {
      const result = await this.commands.execute(
        {
          scope: command.principal.userId,
          operation: "proposal:create",
          key: command.key,
          command: commandJson(input),
        },
        async (tx) => {
          const now = await this.clock(tx);
          const hints = normalizeProposal(input, this.config.policy, now);
          if (input.sourceType === "LEARNING_REQUEST") {
            const request = await this.requests.lockForProposal(
              tx,
              input.learningRequestId!,
              command.principal.userId,
            );
            if (
              request.ownerId !== recipientId ||
              request.skillId !== source.skillId
            )
              throw new ConflictException("REQUEST_VERSION_CONFLICT");
            await this.sharing.assertTeacherEligible(tx, {
              userId: command.principal.userId,
              skillId: request.skillId,
              verifiedRequired: request.verifiedTeacherOnly,
            });
          } else {
            const target = await this.sharing.connectionTarget(
              tx,
              input.recipientSharingSkillId!,
            );
            if (
              target.userId !== recipientId ||
              target.skillId !== source.skillId
            )
              throw new ConflictException("DIRECT_TARGET_UNAVAILABLE");
          }
          const day = await tx.proposal.count({
            where: {
              proposerId: command.principal.userId,
              createdAt: { gt: new Date(now.getTime() - 86400000) },
            },
          });
          const hour = await tx.proposal.count({
            where: {
              proposerId: command.principal.userId,
              createdAt: { gt: new Date(now.getTime() - 3600000) },
            },
          });
          if (
            day >= this.config.policy.proposalsPerDay ||
            hour >= this.config.policy.proposalsPerHour
          )
            throw new HttpException("PROPOSAL_RATE_LIMIT", 429);
          if (
            input.sourceType === "DIRECT_SEARCH" &&
            (await tx.proposal.findFirst({
              where: {
                proposerId: command.principal.userId,
                recipientId,
                skillId: source.skillId,
                sourceType: "DIRECT_SEARCH",
                createdAt: {
                  gt: new Date(
                    now.getTime() -
                      this.config.policy.directCooldownHours * 3600000,
                  ),
                },
              },
            }))
          )
            throw new HttpException("DIRECT_INVITATION_COOLDOWN", 429);
          const row = await tx.proposal.create({
            data: {
              ...hints,
              sourceType: input.sourceType,
              requestId: input.learningRequestId ?? null,
              targetSharingSkillId: input.recipientSharingSkillId ?? null,
              proposerId: command.principal.userId,
              recipientId,
              skillId: source.skillId,
              expiresAt: new Date(
                now.getTime() + this.config.policy.proposalTtlDays * 86400000,
              ),
              status: "PENDING",
            },
          });
          await this.audit.append(tx, {
            actor: auditActorFromActor(
              await this.actors.require(tx, command.principal),
            ),
            action: "PROPOSAL_CREATE",
            target: { type: "PROPOSAL", id: row.id },
            after: { status: row.status, version: row.version },
            reason: "Connection proposal created",
            context: command.context,
          });
          await this.notify(tx, row, "proposal.created");
          return { id: row.id, status: row.status, version: row.version };
        },
        authorize,
      );
      return {
        proposal: await this.get(command.principal, result.value.id),
        replayed: result.replayed,
      };
    } catch (error) {
      this.rethrow(error);
    }
  }
  private async validateAcceptance(
    tx: TransactionContext,
    snapshot: Proposal,
    input: { expectedRequestVersion?: number },
  ) {
    await this.actors.assertConnectionParty(tx, snapshot.proposerId);
    await this.actors.assertConnectionParty(tx, snapshot.recipientId);
    if (snapshot.requestId) {
      const request = await this.requests.lockForProposal(
        tx,
        snapshot.requestId,
        snapshot.proposerId,
      );
      if (
        request.skillId !== snapshot.skillId ||
        request.ownerId !== snapshot.recipientId ||
        (input.expectedRequestVersion !== undefined &&
          input.expectedRequestVersion !== request.version)
      )
        throw new ConflictException("REQUEST_VERSION_CONFLICT");
      await this.sharing.assertTeacherEligible(tx, {
        userId: snapshot.proposerId,
        skillId: request.skillId,
        verifiedRequired: request.verifiedTeacherOnly,
      });
      return request.version;
    }
    const target = await this.sharing.connectionTarget(
      tx,
      snapshot.targetSharingSkillId!,
    );
    if (
      target.userId !== snapshot.recipientId ||
      target.skillId !== snapshot.skillId
    )
      throw new ConflictException("DIRECT_TARGET_UNAVAILABLE");
  }
  async mutate(
    command: SkillCommand,
    id: string,
    action: "update" | "accept" | "reject" | "withdraw",
    input: Partial<ProposalHints> & {
      expectedVersion: number;
      expectedRequestVersion?: number;
    },
  ) {
    const snapshot = await this.raw(this.db, id);
    const permission = {
      update: "proposal:update:self",
      accept: "proposal:accept:recipient",
      reject: "proposal:reject:recipient",
      withdraw: "proposal:withdraw:self",
    }[action];
    const authorize = async (tx: TransactionContext) => {
      await this.parties(tx, command.principal, snapshot, permission);
      if (
        (action === "update" || action === "withdraw"
          ? snapshot.proposerId
          : snapshot.recipientId) !== command.principal.userId
      )
        throw new NotFoundException();
    };
    try {
      const result = await this.commands.execute(
        {
          scope: command.principal.userId,
          operation: `proposal:${action}`,
          key: command.key,
          command: commandJson({ id, ...input }),
        },
        async (tx) => {
          let requestVersion: number | undefined;
          if (action === "accept")
            requestVersion = await this.validateAcceptance(tx, snapshot, input);
          const row = await this.raw(tx, id, true),
            now = await this.clock(tx);
          if (row.version !== input.expectedVersion || row.status !== "PENDING")
            throw new ConflictException("PROPOSAL_VERSION_CONFLICT");
          if (!row.expiresAt || row.expiresAt <= now)
            throw new ConflictException("PROPOSAL_EXPIRED");
          let data: Prisma.ProposalUpdateInput;
          const resolveStatus = () => {
            if (action === "accept") {
              return "ACCEPTED" as const;
            }
            if (action === "reject") {
              return "REJECTED" as const;
            }
            return "WITHDRAWN" as const;
          };
          if (action === "update") {
            const merged = {
              message: row.message,
              exchangeTypeHint: row.exchangeTypeHint,
              proposedCredit: formatCredit(row.proposedCredit),
              proposedDurationMinutes: row.proposedDurationMinutes,
              initialSessionCount: row.initialSessionCount,
              candidateSlots: row.candidateSlots as {
                startAt: string;
                endAt: string;
              }[],
              ...input,
            };
            data = normalizeProposal(merged, this.config.policy, now);
          } else
            data = {
              status: resolveStatus(),
              terminalAt: now,
            };
          const updated = await tx.proposal.update({
            where: { id, version: input.expectedVersion },
            data: { ...data, version: { increment: 1 } },
          });
          if (action === "accept") {
            if (snapshot.requestId)
              await this.requests.beginNegotiation(
                tx,
                snapshot.requestId,
                requestVersion!,
              );
            await this.conversations.openFromAccepted(tx, updated);
          }
          await this.audit.append(tx, {
            actor: auditActorFromActor(
              await this.actors.require(tx, command.principal),
            ),
            action: action === "update" ? "PROPOSAL_UPDATE" : "PROPOSAL_DECIDE",
            target: { type: "PROPOSAL", id },
            before: { status: row.status, version: row.version },
            after: { status: updated.status, version: updated.version },
            reason: `Connection proposal ${action}`,
            context: command.context,
          });
          const eventType = {
            update: "proposal.updated",
            accept: "proposal.accepted",
            reject: "proposal.rejected",
            withdraw: "proposal.withdrawn",
          }[action];
          await this.notify(tx, updated, eventType);
          return { id, status: updated.status, version: updated.version };
        },
        authorize,
      );
      const proposal = await this.get(command.principal, result.value.id);
      const conversation =
        action === "accept"
          ? await this.conversations.readForProposal(this.db, id)
          : undefined;
      return conversation
        ? { proposal, conversation: conversationView(conversation) }
        : { proposal };
    } catch (error) {
      this.rethrow(error);
    }
  }
  async notify(
    tx: TransactionContext,
    row: Proposal,
    type: string,
    source: string = randomUUID(),
  ) {
    // Notifications are intentionally generic; no proposal text is copied to the inbox/feed.
    const recipient =
      type === "proposal.created" ||
      type === "proposal.updated" ||
      type === "proposal.withdrawn"
        ? row.recipientId
        : row.proposerId;
    // All feed-counter locks are acquired together and in UUID order, including notification triggers.
    await this.events.lockRecipients(tx, [row.proposerId, row.recipientId]);
    await this.notifications.create(tx, {
      userId: recipient,
      type,
      proposalId: row.id,
    });
    await this.events.append(
      tx,
      [row.proposerId, row.recipientId],
      source,
      type,
      { proposalId: row.id },
    );
  }
  private rethrow(error: unknown): never {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002"
    )
      throw new ConflictException("PROPOSAL_ALREADY_PENDING");
    throw error;
  }
}
