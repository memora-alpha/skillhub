import {
  Injectable,
  OnModuleInit,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import type { Principal } from "../../auth/application/services/sessions.service";
import { SkillsService } from "../../skills/application/skills.service";
import { SkillActorService } from "../../users/application/services/skill-actor.service";
import { ProfileReader } from "../../users/application/services/profile-reader.service";
import { PublicSkillReader } from "../../users/application/services/public-skill-reader";
import { IdempotencyService } from "../../../infrastructure/idempotency/idempotency.service";
import { TransactionRunner } from "../../../infrastructure/database/transaction-runner";
import type { TransactionContext } from "../../../infrastructure/database/transaction-context";
import type {
  SharingSkillLevel,
  SkillVerificationStatus,
} from "../../../generated/prisma/client";
import {
  SharingSkillsRepository,
  ownSharing,
  publicSharing,
  type SharingQuery,
} from "../infrastructure/sharing-skills.repository";
import {
  commandJson,
  uniqueConflict,
  type SkillCommand,
} from "../../skills/application/skill-contracts";
import { text, expectedVersion } from "../../skills/domain/skill-policy";
import { AuditWriter } from "../../audit/application/audit-writer";
import { auditActorFromActor } from "../../audit/application/audit.types";
export type SharingInput = {
  skillId: string;
  level: SharingSkillLevel;
  description: string;
  experienceYears?: string | null;
  isVisible?: boolean;
};
@Injectable()
export class SharingSkillsService implements OnModuleInit {
  constructor(
    private readonly repository: SharingSkillsRepository,
    private readonly skills: SkillsService,
    private readonly actors: SkillActorService,
    private readonly commands: IdempotencyService,
    private readonly transactions: TransactionRunner,
    private readonly profiles: ProfileReader,
    private readonly publicReader: PublicSkillReader,
    private readonly audit: AuditWriter,
  ) {}
  onModuleInit(): void {
    this.publicReader.register((userId) =>
      this.publicList(userId, { limit: 20 }),
    );
  }
  publicList(userId: string, query: SharingQuery) {
    return this.repository.list(userId, query, true);
  }
  async ownList(principal: Principal, query: SharingQuery) {
    await this.transactions.run(async (tx) => {
      await this.actors.require(tx, principal);
    });
    return this.repository.list(principal.userId, query);
  }
  async search(principal: Principal, skillId: string, query: SharingQuery) {
    await this.transactions.run(async (tx) => {
      await this.actors.require(tx, principal);
    });
    await this.skills.detail(skillId);
    const result = await this.repository.search(skillId, query);
    const data = await Promise.all(
      result.data.map(async (row) => {
        const p = await this.profiles.profile(row.userId, true);
        return {
          ...publicSharing(row),
          user: {
            userId: row.userId,
            fullName: p.fullName,
            bio: p.bio,
            avatarUrl: p.avatarUrl,
            reputationScore: p.reputationScore,
          },
        };
      }),
    );
    return { ...result, data };
  }
  async assertOwnedActive(tx: TransactionContext, userId: string, id: string) {
    const row = await this.repository.get(id, tx, true);
    if (row.userId !== userId) throw new NotFoundException();
    if (row.archivedAt) throw new ConflictException("SHARING_SKILL_ARCHIVED");
    return row;
  }
  read(id: string, tx?: TransactionContext) {
    return this.repository.get(id, tx);
  }
  lock(tx: TransactionContext, id: string) {
    return this.repository.get(id, tx, true);
  }
  setVerification(
    tx: TransactionContext,
    id: string,
    status: SkillVerificationStatus,
  ) {
    return this.repository.update(tx, id, {
      verificationStatus: status,
      version: { increment: 1 },
    });
  }
  async refreshCounter(tx: TransactionContext, userId: string) {
    await this.actors.counter(
      tx,
      userId,
      await this.repository.count(tx, userId),
    );
  }
  async assertTeacherEligible(
    tx: TransactionContext,
    input: { userId: string; skillId: string; verifiedRequired: boolean },
  ) {
    const row = await this.repository.eligible(
      tx,
      input.userId,
      input.skillId,
      input.verifiedRequired,
    );
    if (!row) throw new ConflictException("TEACHER_SKILL_NOT_ELIGIBLE");
    await this.skills.assertActive(tx, input.skillId);
    const locked = await this.repository.get(row.id, tx, true);
    if (
      locked.archivedAt ||
      (input.verifiedRequired && locked.verificationStatus !== "VERIFIED")
    )
      throw new ConflictException("TEACHER_SKILL_NOT_ELIGIBLE");
    return {
      sharingSkillId: row.id,
      verificationStatus: row.verificationStatus,
    };
  }
  async connectionTarget(tx: TransactionContext, id: string) {
    const snapshot = await this.repository.get(id, tx);
    await this.skills.assertActive(tx, snapshot.skillId);
    const row = await this.repository.get(id, tx, true);
    if (row.archivedAt || !row.isVisible)
      throw new ConflictException("DIRECT_TARGET_UNAVAILABLE");
    return { sharingSkillId: row.id, userId: row.userId, skillId: row.skillId };
  }
  async getMatchingSnapshot(tx: TransactionContext, userId: string) {
    return this.repository.matchingSnapshot(tx, userId);
  }
  async create(command: SkillCommand, input: SharingInput) {
    const data = { ...input, description: text(input.description, 20, 1500) };
    try {
      const result = await this.commands.execute(
        {
          scope: command.principal.userId,
          operation: "sharing-skill:create:self",
          key: command.key,
          command: commandJson(data),
        },
        async (tx) => {
          await this.actors.require(
            tx,
            command.principal,
            "sharing-skill:create:self",
          );
          await this.skills.assertActive(tx, data.skillId);
          const row = await this.repository.create(tx, {
            ...data,
            userId: command.principal.userId,
            verificationStatus: "UNVERIFIED",
            isVisible: data.isVisible ?? true,
          });
          return {
            id: row.id,
            status: row.verificationStatus,
            version: row.version,
          };
        },
        async (tx) => {
          await this.actors.require(
            tx,
            command.principal,
            "sharing-skill:create:self",
          );
        },
      );
      return ownSharing(await this.repository.get(result.value.id));
    } catch (error) {
      uniqueConflict(error);
    }
  }
  async restore(
    command: SkillCommand,
    id: string,
    input: { expectedVersion: number },
  ) {
    try {
      const result = await this.commands.execute(
        {
          scope: command.principal.userId,
          operation: "sharing-skill:restore:self",
          key: command.key,
          command: commandJson({ id, ...input }),
        },
        async (tx) => {
          const actor = await this.actors.require(
            tx,
            command.principal,
            "sharing-skill:restore:self",
          );
          // Read ownership first, then lock catalog before the sharing row.
          const snapshot = await this.repository.get(id, tx);
          if (snapshot.userId !== actor.userId) throw new NotFoundException();
          await this.skills.assertActive(tx, snapshot.skillId);
          const before = await this.repository.get(id, tx, true);
          expectedVersion(before.version, input.expectedVersion);
          if (!before.archivedAt)
            throw new ConflictException("SHARING_SKILL_NOT_ARCHIVED");
          if (
            await this.repository.findUnarchived(
              tx,
              actor.userId,
              before.skillId,
            )
          )
            throw new ConflictException("SKILL_DUPLICATE");
          const after = await this.repository.update(tx, id, {
            archivedAt: null,
            version: { increment: 1 },
          });
          await this.refreshCounter(tx, actor.userId);
          await this.audit.append(tx, {
            actor: auditActorFromActor(actor),
            action: "SHARING_SKILL_RESTORE",
            target: { type: "SHARING_SKILL", id },
            before: this.restoreSnapshot(before),
            after: this.restoreSnapshot(after),
            reason: "Owner restored sharing skill",
            context: command.context,
          });
          return {
            id,
            status: after.verificationStatus,
            version: after.version,
          };
        },
        async (tx) => {
          await this.actors.require(
            tx,
            command.principal,
            "sharing-skill:restore:self",
          );
        },
      );
      return ownSharing(await this.repository.get(result.value.id));
    } catch (error) {
      uniqueConflict(error);
    }
  }
  private restoreSnapshot(row: {
    archivedAt: Date | null;
    isVisible: boolean;
    verificationStatus: SkillVerificationStatus;
    version: number;
  }) {
    return {
      archivedAt: row.archivedAt?.toISOString() ?? null,
      isVisible: row.isVisible,
      verificationStatus: row.verificationStatus,
      version: row.version,
    };
  }
  async change(
    command: SkillCommand,
    id: string,
    input: Partial<Omit<SharingInput, "skillId">> & { expectedVersion: number },
    archive = false,
  ) {
    const permission = archive
      ? "sharing-skill:archive:self"
      : "sharing-skill:update:self";
    const { expectedVersion: version, ...patch } = input;
    const result = await this.commands.execute(
      {
        scope: command.principal.userId,
        operation: permission,
        key: command.key,
        command: commandJson({ id, ...input }),
      },
      async (tx) => {
        await this.actors.require(tx, command.principal, permission);
        const row = await this.assertOwnedActive(
          tx,
          command.principal.userId,
          id,
        );
        expectedVersion(row.version, version);
        if (
          archive &&
          row.skillVerificationSharingSkillIdRecords.some(
            (item) => item.status === "PENDING",
          )
        )
          throw new ConflictException("VERIFICATION_PENDING");
        const updated = await this.repository.update(tx, id, {
          ...patch,
          ...(patch.description !== undefined
            ? { description: text(patch.description, 20, 1500) }
            : {}),
          ...(archive ? { archivedAt: new Date() } : {}),
          version: { increment: 1 },
        });
        if (archive) await this.refreshCounter(tx, row.userId);
        return {
          id,
          status: archive ? "ARCHIVED" : updated.verificationStatus,
          version: updated.version,
        };
      },
      async (tx) => {
        await this.actors.require(tx, command.principal, permission);
      },
    );
    return ownSharing(await this.repository.get(result.value.id));
  }
}
