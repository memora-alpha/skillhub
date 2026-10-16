import {
  ConflictException,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { TransactionRunner } from "../../../infrastructure/database/transaction-runner";
import type { TransactionContext } from "../../../infrastructure/database/transaction-context";
import { IdempotencyService } from "../../../infrastructure/idempotency/idempotency.service";
import { AuditWriter } from "../../audit/application/audit-writer";
import { auditActorFromActor } from "../../audit/application/audit.types";
import { SkillActorService } from "../../users/application/services/skill-actor.service";
import { TagsRepository } from "../infrastructure/tags.repository";
import {
  approveTagRequestSchema,
  createTagSchema,
  normalizeTagLabel,
  parseTagInput,
  rejectTagRequestSchema,
  requireTagAdmin,
  tagRequestQuerySchema,
} from "../domain/tag-policy";
import { expectedVersion } from "../domain/skill-policy";
import { commandJson, type SkillCommand } from "./skill-contracts";
import {
  tagRequestSnapshot,
  tagSnapshot,
  tagUniqueConflict,
  type ApproveTagRequestInput,
  type CreateTagInput,
  type RejectTagRequestInput,
  type TagRequestQuery,
} from "./tag-contracts";

@Injectable()
export class TagRequestsService {
  constructor(
    private readonly repository: TagsRepository,
    private readonly actors: SkillActorService,
    private readonly commands: IdempotencyService,
    private readonly transactions: TransactionRunner,
    private readonly audit: AuditWriter,
  ) {}

  async create(command: SkillCommand, input: CreateTagInput) {
    const data = normalizeTagLabel(parseTagInput(createTagSchema, input).label);
    try {
      const result = await this.commands.execute(
        {
          scope: command.principal.userId,
          operation: "tag-request:create:self",
          key: command.key,
          command: commandJson(data),
        },
        async (tx) => {
          const actor = await this.submitActor(tx, command);
          const existing = await this.repository.findByKey(tx, data.labelKey);
          if (existing)
            throw new ConflictException(
              existing.status === "ACTIVE"
                ? "TAG_ALREADY_EXISTS"
                : "TAG_UNAVAILABLE",
            );
          const row = await this.repository.createRequest(tx, {
            ...data,
            requestedByUserId: actor.userId,
          });
          await this.audit.append(tx, {
            actor: auditActorFromActor(actor),
            action: "TAG_REQUEST_CREATE",
            target: { type: "TAG_REQUEST", id: row.id },
            after: tagRequestSnapshot(row),
            reason: "Tag requested",
            context: command.context,
          });
          return { id: row.id, status: row.status, version: row.version };
        },
        async (tx) => {
          await this.submitActor(tx, command);
        },
      );
      return this.repository.getRequest(result.value.id);
    } catch (error) {
      tagUniqueConflict(error, "TAG_REQUEST_PENDING");
    }
  }

  mine(command: SkillCommand, input: TagRequestQuery) {
    const query = parseTagInput(tagRequestQuerySchema, input);
    return this.transactions.run(async (tx) => {
      const actor = await this.actors.require(
        tx,
        command.principal,
        "tag-request:read:self",
      );
      return this.repository.listRequests(tx, query, actor.userId);
    });
  }

  mineDetail(command: SkillCommand, id: string) {
    return this.transactions.run(async (tx) => {
      const actor = await this.actors.require(
        tx,
        command.principal,
        "tag-request:read:self",
      );
      return this.repository.getRequest(id, tx, false, actor.userId);
    });
  }

  adminList(command: SkillCommand, input: TagRequestQuery) {
    const query = parseTagInput(tagRequestQuerySchema, input);
    return this.transactions.run(async (tx) => {
      await this.adminActor(tx, command, "tag-request:read");
      return this.repository.listRequests(tx, query);
    });
  }

  adminDetail(command: SkillCommand, id: string) {
    return this.transactions.run(async (tx) => {
      await this.adminActor(tx, command, "tag-request:read");
      return this.repository.getRequest(id, tx);
    });
  }

  approve(command: SkillCommand, id: string, input: ApproveTagRequestInput) {
    return this.decide(
      command,
      id,
      parseTagInput(approveTagRequestSchema, input),
      true,
    );
  }

  reject(command: SkillCommand, id: string, input: RejectTagRequestInput) {
    return this.decide(
      command,
      id,
      parseTagInput(rejectTagRequestSchema, input),
      false,
    );
  }

  private async decide(
    command: SkillCommand,
    id: string,
    input: { expectedVersion: number; reason?: string },
    approve: boolean,
  ) {
    const permission = approve ? "tag-request:approve" : "tag-request:reject";
    const result = await this.commands.execute(
      {
        scope: command.principal.userId,
        operation: permission,
        key: command.key,
        command: commandJson({ id, ...input }),
      },
      async (tx) => {
        const actor = await this.adminActor(tx, command, permission);
        const before = await this.repository.getRequest(id, tx, true);
        expectedVersion(before.version, input.expectedVersion);
        if (before.status !== "PENDING")
          throw new ConflictException("TAG_REQUEST_NOT_PENDING");
        let resultTagId: string | null = null;
        if (approve) {
          const { row, created } = await this.repository.createTagIfAbsent(tx, {
            label: before.label,
            labelKey: before.labelKey,
            createdByUserId: actor.userId,
          });
          if (row.status !== "ACTIVE")
            throw new ConflictException("TAG_UNAVAILABLE");
          resultTagId = row.id;
          if (created)
            await this.audit.append(tx, {
              actor: auditActorFromActor(actor),
              action: "TAG_CREATE",
              target: { type: "TAG", id: row.id },
              after: tagSnapshot(row),
              reason: "Tag request approved",
              context: command.context,
            });
        }
        const row = await this.repository.updateRequest(tx, id, {
          status: approve ? "APPROVED" : "REJECTED",
          reviewedByUserId: actor.userId,
          reviewedAt: new Date(),
          resultTagId,
          rejectReason: approve ? null : input.reason,
          version: { increment: 1 },
        });
        await this.audit.append(tx, {
          actor: auditActorFromActor(actor),
          action: approve ? "TAG_REQUEST_APPROVE" : "TAG_REQUEST_REJECT",
          target: { type: "TAG_REQUEST", id },
          before: tagRequestSnapshot(before),
          after: tagRequestSnapshot(row),
          reason: approve ? "Tag request approved" : input.reason!,
          context: command.context,
        });
        return { id, status: row.status, version: row.version };
      },
      async (tx) => {
        await this.adminActor(tx, command, permission);
      },
    );
    return this.repository.getRequest(result.value.id);
  }

  private async adminActor(
    tx: TransactionContext,
    command: SkillCommand,
    permission:
      "tag-request:read" | "tag-request:approve" | "tag-request:reject",
  ) {
    return requireTagAdmin(
      await this.actors.require(tx, command.principal, permission),
    );
  }

  private async submitActor(tx: TransactionContext, command: SkillCommand) {
    const actor = await this.actors.require(
      tx,
      command.principal,
      "tag-request:create:self",
    );
    const blocked: ReadonlySet<string> = actor.blockedPermissions;
    if (blocked.has("CREATE_NEW_ACTIVITY"))
      throw new ForbiddenException("NEW_ACTIVITY_RESTRICTED");
    return actor;
  }
}
