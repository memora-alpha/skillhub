import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { IdempotencyService } from "../../../infrastructure/idempotency/idempotency.service";
import { TransactionRunner } from "../../../infrastructure/database/transaction-runner";
import type { TransactionContext } from "../../../infrastructure/database/transaction-context";
import { SkillActorService } from "../../users/application/services/skill-actor.service";
import { AuditWriter } from "../../audit/application/audit-writer";
import { auditActorFromActor } from "../../audit/application/audit.types";
import { SkillsRepository } from "../infrastructure/skills.repository";
import {
  nameKey,
  skillSlug,
  text,
  expectedVersion,
} from "../domain/skill-policy";
import {
  commandJson,
  uniqueConflict,
  type SkillCommand,
  type SkillQuery,
} from "./skill-contracts";
import type { CatalogStatus } from "../../../generated/prisma/client";

export type CatalogInput = {
  name: string;
  slug?: string;
  description?: string | null;
  categoryId?: string | null;
  status: CatalogStatus;
};
@Injectable()
export class SkillsService {
  constructor(
    private readonly repository: SkillsRepository,
    private readonly actors: SkillActorService,
    private readonly commands: IdempotencyService,
    private readonly transactions: TransactionRunner,
    private readonly audit: AuditWriter,
  ) {}
  list(query: SkillQuery) {
    return this.repository.list(query);
  }
  async detail(id: string) {
    const row = await this.repository.get(id);
    if (row.status !== "ACTIVE") throw new NotFoundException();
    return row;
  }
  async adminList(command: SkillCommand, query: SkillQuery) {
    await this.transactions.run(async (tx) => {
      const actor = await this.actors.require(tx, command.principal);
      if (
        !(
          [
            "skill-catalog:create",
            "skill-catalog:update",
            "skill-catalog:archive",
          ] as const
        ).some(
          (code) =>
            actor.permissions.has(code) && !actor.blockedPermissions.has(code),
        )
      )
        throw new ForbiddenException("SKILL_PERMISSION_REQUIRED");
    });
    return this.repository.list(query, true);
  }
  async assertActive(tx: TransactionContext, id: string) {
    const row = await this.repository.get(id, tx, true);
    if (row.status !== "ACTIVE")
      throw new ConflictException("SKILL_NOT_ACTIVE");
    return row;
  }
  async create(command: SkillCommand, input: CatalogInput) {
    const data = {
      ...input,
      name: text(input.name, 2, 100),
      nameKey: nameKey(input.name),
      slug: input.slug ?? skillSlug(input.name),
      description:
        input.description === undefined || input.description === null
          ? input.description
          : text(input.description, 0, 500),
    };
    try {
      const result = await this.commands.execute(
        {
          scope: command.principal.userId,
          operation: "skill-catalog:create",
          key: command.key,
          command: commandJson(data),
        },
        async (tx) => {
          const actor = await this.actors.require(
            tx,
            command.principal,
            "skill-catalog:create",
          );
          if (data.categoryId)
            await this.repository.category(tx, data.categoryId);
          const row = await this.repository.create(tx, data);
          await this.audit.append(tx, {
            actor: auditActorFromActor(actor),
            action: "SKILL_CATALOG_CREATE",
            target: { type: "SKILL", id: row.id },
            after: this.snapshot(row),
            reason: "Catalog skill created",
            context: command.context,
          });
          return { id: row.id, status: row.status, version: row.version };
        },
        async (tx) => {
          await this.actors.require(
            tx,
            command.principal,
            "skill-catalog:create",
          );
        },
      );
      return this.repository.get(result.value.id);
    } catch (error) {
      uniqueConflict(error);
    }
  }
  async change(
    command: SkillCommand,
    id: string,
    input: Partial<CatalogInput> & { expectedVersion: number; reason?: string },
    archive = false,
  ) {
    const permission = archive
      ? "skill-catalog:archive"
      : "skill-catalog:update";
    const { expectedVersion: version, reason, ...patch } = input;
    const data = {
      ...patch,
      ...(patch.name !== undefined
        ? { name: text(patch.name, 2, 100), nameKey: nameKey(patch.name) }
        : {}),
      ...(patch.description !== undefined
        ? {
            description:
              patch.description === null
                ? null
                : text(patch.description, 0, 500),
          }
        : {}),
    };
    try {
      const result = await this.commands.execute(
        {
          scope: command.principal.userId,
          operation: permission,
          key: command.key,
          command: commandJson({ id, ...input }),
        },
        async (tx) => {
          const actor = await this.actors.require(
            tx,
            command.principal,
            permission,
          );
          const before = await this.repository.get(id, tx, true);
          expectedVersion(before.version, version);
          if (before.status === "ARCHIVED")
            throw new ConflictException("SKILL_ARCHIVED");
          if (data.categoryId)
            await this.repository.category(tx, data.categoryId);
          const after = await this.repository.update(tx, id, {
            ...data,
            ...(archive ? { status: "ARCHIVED" } : {}),
            version: { increment: 1 },
          });
          await this.audit.append(tx, {
            actor: auditActorFromActor(actor),
            action: archive ? "SKILL_CATALOG_ARCHIVE" : "SKILL_CATALOG_UPDATE",
            target: { type: "SKILL", id },
            before: this.snapshot(before),
            after: this.snapshot(after),
            reason: archive
              ? text(reason ?? "", 1, 2000)
              : "Catalog skill updated",
            context: command.context,
          });
          return { id, status: after.status, version: after.version };
        },
        async (tx) => {
          await this.actors.require(tx, command.principal, permission);
        },
      );
      return this.repository.get(result.value.id);
    } catch (error) {
      uniqueConflict(error);
    }
  }
  private snapshot(row: {
    name: string;
    slug: string;
    status: CatalogStatus;
    version: number;
  }) {
    return {
      name: row.name,
      slug: row.slug,
      status: row.status,
      version: row.version,
    };
  }
}
