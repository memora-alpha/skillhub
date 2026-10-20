import { ConflictException, Injectable } from "@nestjs/common";
import { TransactionRunner } from "../../../../infrastructure/database/transaction-runner";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import { IdempotencyService } from "../../../../infrastructure/idempotency/idempotency.service";
import { AuditWriter } from "../../../audit/application/services/audit-writer";
import { auditActorFromActor } from "../../../audit/application/contracts/audit.types";
import { SkillActorService } from "../../../users/application/services/skill-actor.service";
import { TagsRepository } from "../../infrastructure/persistence/tags.repository";
import {
  adminTagQuerySchema,
  createTagSchema,
  normalizeTagLabel,
  parseTagInput,
  requireTagAdmin,
  updateTagSchema,
} from "../../domain/tag-policy";
import { expectedVersion } from "../../domain/skill-policy";
import { commandJson, type SkillCommand } from "../contracts/skill-contracts";
import {
  tagSnapshot,
  tagUniqueConflict,
  type AdminTagQuery,
  type CreateTagInput,
  type UpdateTagInput,
} from "../contracts/tag-contracts";

@Injectable()
export class TagsService {
  constructor(
    private readonly repository: TagsRepository,
    private readonly actors: SkillActorService,
    private readonly commands: IdempotencyService,
    private readonly transactions: TransactionRunner,
    private readonly audit: AuditWriter,
  ) {}

  adminList(command: SkillCommand, input: AdminTagQuery) {
    const query = parseTagInput(adminTagQuerySchema, input);
    return this.transactions.run(async (tx) => {
      await this.authorize(tx, command, "tag:read");
      return this.repository.listTags(tx, query);
    });
  }

  async create(command: SkillCommand, input: CreateTagInput) {
    const data = normalizeTagLabel(parseTagInput(createTagSchema, input).label);
    try {
      const result = await this.commands.execute(
        {
          scope: command.principal.userId,
          operation: "tag:create",
          key: command.key,
          command: commandJson(data),
        },
        async (tx) => {
          const actor = await this.authorize(tx, command, "tag:create");
          const row = await this.repository.createTag(tx, {
            ...data,
            status: "ACTIVE",
            createdByUserId: actor.userId,
          });
          await this.audit.append(tx, {
            actor: auditActorFromActor(actor),
            action: "TAG_CREATE",
            target: { type: "TAG", id: row.id },
            after: tagSnapshot(row),
            reason: "Tag created",
            context: command.context,
          });
          return { id: row.id, status: row.status, version: row.version };
        },
        async (tx) => {
          await this.authorize(tx, command, "tag:create");
        },
      );
      return this.repository.getTag(result.value.id);
    } catch (error) {
      tagUniqueConflict(error, "TAG_ALREADY_EXISTS");
    }
  }

  async update(command: SkillCommand, id: string, input: UpdateTagInput) {
    const data = parseTagInput(updateTagSchema, input);
    try {
      const result = await this.commands.execute(
        {
          scope: command.principal.userId,
          operation: "tag:update",
          key: command.key,
          command: commandJson({ id, ...data }),
        },
        async (tx) => {
          const actor = await this.authorize(tx, command, "tag:update");
          const before = await this.repository.getTag(id, tx, true);
          expectedVersion(before.version, data.expectedVersion);
          if (before.status === "ARCHIVED")
            throw new ConflictException("TAG_ARCHIVED");
          const row = await this.repository.updateTag(tx, id, {
            ...(data.label !== undefined ? normalizeTagLabel(data.label) : {}),
            ...(data.status !== undefined ? { status: data.status } : {}),
            version: { increment: 1 },
          });
          await this.audit.append(tx, {
            actor: auditActorFromActor(actor),
            action: "TAG_UPDATE",
            target: { type: "TAG", id },
            before: tagSnapshot(before),
            after: tagSnapshot(row),
            reason: data.reason,
            context: command.context,
          });
          return { id, status: row.status, version: row.version };
        },
        async (tx) => {
          await this.authorize(tx, command, "tag:update");
        },
      );
      return this.repository.getTag(result.value.id);
    } catch (error) {
      tagUniqueConflict(error, "TAG_ALREADY_EXISTS");
    }
  }

  private async authorize(
    tx: TransactionContext,
    command: SkillCommand,
    permission: "tag:read" | "tag:create" | "tag:update",
  ) {
    return requireTagAdmin(
      await this.actors.require(tx, command.principal, permission),
    );
  }
}
