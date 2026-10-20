import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../../../infrastructure/database/prisma.service";
import { TransactionRunner } from "../../../../infrastructure/database/transaction-runner";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import { IdempotencyService } from "../../../../infrastructure/idempotency/idempotency.service";
import { SkillActorService } from "../../../users/application/services/skill-actor.service";
import { AuditWriter } from "../../../audit/application/services/audit-writer";
import { auditActorFromActor } from "../../../audit/application/contracts/audit.types";
import { SkillsRepository } from "../../infrastructure/persistence/skills.repository";
import { expectedVersion, nameKey } from "../../domain/skill-policy";
import {
  createSkillLevelSchema,
  updateSkillLevelSchema,
  parseSkillLevel,
  type CreateSkillLevel,
  type UpdateSkillLevel,
} from "../../domain/skill-level.policy";
import { commandJson, type SkillCommand } from "../contracts/skill-contracts";
import type { SkillLevel } from "../../../../generated/prisma/client";

const permission = "skill-level:manage";

@Injectable()
export class SkillLevelsService {
  constructor(
    private readonly db: PrismaService,
    private readonly skills: SkillsRepository,
    private readonly actors: SkillActorService,
    private readonly transactions: TransactionRunner,
    private readonly commands: IdempotencyService,
    private readonly audit: AuditWriter,
  ) {}

  list(skillId: string, command?: SkillCommand) {
    return this.transactions.run(async (tx) => {
      if (command) await this.requireAdmin(tx, command);
      const skill = await this.skills.get(skillId, tx);
      if (!command && skill.status !== "ACTIVE") throw new NotFoundException();
      return tx.skillLevel.findMany({
        where: { skillId, ...(command ? {} : { status: "ACTIVE" }) },
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      });
    });
  }

  async create(
    command: SkillCommand,
    skillId: string,
    input: CreateSkillLevel,
  ) {
    const data = parseSkillLevel(createSkillLevelSchema, input);
    return this.mutate(command, skillId, data, async (tx) => {
      const { reason, ...fields } = data;
      const row = await tx.skillLevel.create({
        data: { ...fields, skillId, nameKey: nameKey(fields.name) },
      });
      return { row, reason };
    });
  }

  async update(
    command: SkillCommand,
    skillId: string,
    id: string,
    input: UpdateSkillLevel,
  ) {
    const data = parseSkillLevel(updateSkillLevelSchema, input);
    return this.mutate(command, skillId, { id, ...data }, async (tx) => {
      const before = await tx.skillLevel.findFirst({ where: { id, skillId } });
      if (!before) throw new NotFoundException("SKILL_LEVEL_NOT_FOUND");
      const { expectedVersion: version, reason, ...patch } = data;
      expectedVersion(before.version, version);
      const row = await tx.skillLevel.update({
        where: { id },
        data: {
          ...patch,
          ...(patch.name !== undefined ? { nameKey: nameKey(patch.name) } : {}),
          version: { increment: 1 },
        },
      });
      return { row, before, reason };
    });
  }

  private async requireAdmin(tx: TransactionContext, command: SkillCommand) {
    const actor = await this.actors.require(tx, command.principal, permission);
    if (!actor.roles.includes("ADMIN"))
      throw new ForbiddenException("ADMIN_REQUIRED");
    return actor;
  }

  private async mutate(
    command: SkillCommand,
    skillId: string,
    input: object,
    write: (
      tx: TransactionContext,
    ) => Promise<{ row: SkillLevel; before?: SkillLevel; reason: string }>,
  ) {
    try {
      const result = await this.commands.execute(
        {
          scope: command.principal.userId,
          operation: permission,
          key: command.key,
          command: commandJson({ skillId, ...input }),
        },
        async (tx) => {
          const actor = await this.requireAdmin(tx, command);
          const skill = await this.skills.get(skillId, tx, true);
          if (skill.status === "ARCHIVED")
            throw new ConflictException("SKILL_ARCHIVED");
          const { row, before, reason } = await write(tx);
          await this.audit.append(tx, {
            actor: auditActorFromActor(actor),
            action: "SKILL_LEVEL_UPDATE",
            target: { type: "SKILL_LEVEL", id: row.id },
            before: before ? this.snapshot(before) : undefined,
            after: this.snapshot(row),
            reason,
            context: command.context,
          });
          return { id: row.id, status: row.status, version: row.version };
        },
        async (tx) => {
          await this.requireAdmin(tx, command);
        },
      );
      return this.db.skillLevel.findUniqueOrThrow({
        where: { id: result.value.id },
      });
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "P2002"
      ) {
        throw new ConflictException("SKILL_LEVEL_DUPLICATE");
      }
      throw error;
    }
  }

  private snapshot(row: SkillLevel) {
    return {
      skillId: row.skillId,
      code: row.code,
      name: row.name,
      description: row.description,
      sortOrder: row.sortOrder,
      status: row.status,
      version: row.version,
    };
  }
}
