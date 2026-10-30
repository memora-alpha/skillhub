import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { Readable } from "node:stream";
import type { Principal } from "../../../auth/application/services/sessions.service";
import type { SkillCommand } from "../../../skills/application/contracts/skill-contracts";
import {
  commandJson,
  uniqueConflict,
} from "../../../skills/application/contracts/skill-contracts";
import { expectedVersion, text } from "../../../skills/domain/skill-policy";
import { SharingSkillsService } from "../../../sharing-skills/application/services/sharing-skills.service";
import { SkillActorService } from "../../../users/application/services/skill-actor.service";
import { IdempotencyService } from "../../../../infrastructure/idempotency/idempotency.service";
import { TransactionRunner } from "../../../../infrastructure/database/transaction-runner";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import { FileStorageService } from "../../../../infrastructure/storage/file-storage.service";
import { FileAttachmentService } from "../../../../infrastructure/storage/file-attachment.service";
import { AuditWriter } from "../../../audit/application/services/audit-writer";
import { auditActorFromActor } from "../../../audit/application/contracts/audit.types";
import { OutboxWriter } from "../../../../infrastructure/events/outbox-writer";
import {
  VerificationsRepository,
  verificationView,
} from "../../infrastructure/persistence/verifications.repository";
import type { VerificationRequestStatus } from "../../../../generated/prisma/client";
import { VerificationAiService } from "./verification-ai.service";

export type SubmitEvidence = {
  fileIds: string[];
  title?: string;
  description?: string;
};
@Injectable()
export class VerificationsService {
  constructor(
    private readonly repository: VerificationsRepository,
    private readonly sharing: SharingSkillsService,
    private readonly actors: SkillActorService,
    private readonly commands: IdempotencyService,
    private readonly transactions: TransactionRunner,
    private readonly storage: FileStorageService,
    private readonly attachments: FileAttachmentService,
    private readonly audit: AuditWriter,
    private readonly outbox: OutboxWriter,
    @Optional() private readonly ai?: VerificationAiService,
  ) {}
  private async own(
    tx: TransactionContext,
    principal: Principal,
    id: string,
    active = false,
  ) {
    await this.actors.require(tx, principal);
    const row = active
      ? await this.sharing.assertOwnedActive(tx, principal.userId, id)
      : await this.sharing.read(id, tx);
    if (row.userId !== principal.userId) throw new NotFoundException();
    return row;
  }
  async upload(
    principal: Principal,
    id: string,
    input: {
      name: string;
      claimedMime: string;
      body: Readable;
      correlationId: string;
    },
  ) {
    const actor = await this.transactions.run(async (tx) => {
      await this.actors.require(
        tx,
        principal,
        "skill-verification:submit:self",
      );
      await this.own(tx, principal, id, true);
      return this.actors.require(tx, principal);
    });
    return this.storage.upload({
      actor,
      purpose: "EVIDENCE",
      name: input.name,
      claimedMime: input.claimedMime,
      body: input.body,
      context: { correlationId: input.correlationId },
    });
  }
  async uploadStatus(principal: Principal, id: string, fileId: string) {
    const actor = await this.transactions.run(async (tx) => {
      await this.own(tx, principal, id);
      return this.actors.require(tx, principal);
    });
    return this.attachments.status(actor, fileId);
  }
  async submit(command: SkillCommand, id: string, input: SubmitEvidence) {
    if (
      input.fileIds.length < 1 ||
      input.fileIds.length > 5 ||
      new Set(input.fileIds).size !== input.fileIds.length
    )
      throw new BadRequestException("INVALID_EVIDENCE_BATCH");
    const data = {
      fileIds: [...input.fileIds].sort((left, right) =>
        left.localeCompare(right),
      ),
      ...(input.title !== undefined
        ? { title: text(input.title, 0, 120) }
        : {}),
      ...(input.description !== undefined
        ? { description: text(input.description, 0, 500) }
        : {}),
    };
    try {
      const result = await this.commands.execute(
        {
          scope: command.principal.userId,
          operation: "skill-verification:submit:self",
          key: command.key,
          command: commandJson({ sharingSkillId: id, ...data }),
        },
        async (tx) => {
          const actor = await this.actors.require(
            tx,
            command.principal,
            "skill-verification:submit:self",
          );
          await this.own(tx, command.principal, id, true);
          if (await this.repository.pending(tx, id))
            throw new ConflictException("VERIFICATION_PENDING");
          const request = await this.repository.create(tx, {
            sharingSkillId: id,
            status: "PENDING",
            submittedAt: new Date(),
          });
          // Acquire file locks in the sorted order and persist each binding before its evidence.
          for (const fileId of data.fileIds) {
            const evidenceId = randomUUID();
            const file = await this.attachments.attachReady(tx, actor, fileId, {
              type: "SKILL_EVIDENCE",
              id: evidenceId,
            });
            await this.repository.addEvidence(tx, {
              id: evidenceId,
              verificationId: request.id,
              sharingSkillId: id,
              title: data.title,
              description: data.description,
              mimeType: file.mime,
              storageKey: file.key,
              fileSizeBytes: BigInt(file.size),
              uploadedAt: file.uploadedAt,
              approvalStatus: "PENDING",
              scanStatus: "CLEAN",
              checksum: file.checksum,
              storedFileId: file.id,
            });
          }
          await this.aggregate(tx, id, command.principal.userId);
          await this.ai?.schedule(tx, request.id, null, command.context);
          return {
            id: request.id,
            status: "PENDING",
            version: request.version,
          };
        },
        async (tx) => {
          await this.actors.require(
            tx,
            command.principal,
            "skill-verification:submit:self",
          );
        },
      );
      return verificationView(await this.repository.get(result.value.id));
    } catch (error) {
      uniqueConflict(error);
    }
  }
  async history(
    principal: Principal,
    id: string,
    query: { limit: number; cursor?: string },
  ) {
    await this.transactions.run(async (tx) => {
      await this.own(tx, principal, id);
    });
    return this.repository.list({ ...query, sharingSkillId: id });
  }
  async detail(principal: Principal, id: string, sharingSkillId?: string) {
    await this.transactions.run(async (tx) => {
      if (sharingSkillId) await this.own(tx, principal, sharingSkillId);
      else await this.actors.require(tx, principal, "skill-verification:read");
      const row = await this.repository.get(id, tx);
      if (sharingSkillId && row.sharingSkillId !== sharingSkillId)
        throw new NotFoundException();
    });
    return verificationView(await this.repository.get(id));
  }
  async queue(
    principal: Principal,
    query: {
      limit: number;
      cursor?: string;
      status?: VerificationRequestStatus;
    },
  ) {
    await this.transactions.run(async (tx) => {
      await this.actors.require(tx, principal, "skill-verification:read");
    });
    return this.repository.list({
      ...query,
      status: query.status ?? "PENDING",
    });
  }
  async decide(
    command: SkillCommand,
    id: string,
    input: { expectedVersion: number; rejectReason?: string; note?: string },
    approve: boolean,
  ) {
    const initial = await this.repository.get(id);
    const owner = await this.sharing.read(initial.sharingSkillId);
    const permission = approve
      ? "skill-verification:approve"
      : "skill-verification:reject";
    const reason = approve
      ? "Evidence approved"
      : text(input.rejectReason ?? "", 10, 500);
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
          [owner.userId],
        );
        await this.sharing.assertOwnedActive(
          tx,
          owner.userId,
          initial.sharingSkillId,
        );
        const row = await this.repository.get(id, tx, true);
        expectedVersion(row.version, input.expectedVersion);
        if (row.status !== "PENDING")
          throw new ConflictException("VERIFICATION_ALREADY_DECIDED");
        if (
          row.skillEvidenceSubmissionRecords.length < 1 ||
          row.skillEvidenceSubmissionRecords.length > 5
        )
          throw new ConflictException("INVALID_EVIDENCE_BATCH");
        // Keep row-locking checks sequential on this transaction's connection.
        for (const file of row.skillEvidenceSubmissionRecords) {
          if (!file.storedFileId)
            throw new ConflictException("EVIDENCE_STORAGE_UNBOUND");
          if (approve)
            await this.attachments.assertBoundReady(tx, file.storedFileId, {
              type: "SKILL_EVIDENCE",
              id: file.id,
            });
        }
        const at = new Date();
        const status = approve ? "APPROVED" : "REJECTED";
        const decided = await this.repository.decision(
          tx,
          id,
          status,
          actor.userId,
          at,
          approve ? undefined : reason,
          input.note === undefined ? undefined : text(input.note, 0, 500),
        );
        await this.repository.decideFiles(
          tx,
          id,
          approve,
          actor.userId,
          at,
          approve ? undefined : reason,
        );
        await this.aggregate(tx, row.sharingSkillId, owner.userId);
        await this.audit.append(tx, {
          actor: auditActorFromActor(actor),
          action: approve ? "VERIFY_SKILL_APPROVE" : "VERIFY_SKILL_REJECT",
          target: { type: "SKILL_VERIFICATION", id },
          before: { status: "PENDING" },
          after: { status },
          reason,
          context: command.context,
        });
        await this.outbox.append(tx, {
          eventId: randomUUID(),
          type: "skill.verification.decided",
          version: 1,
          payload: {
            verificationId: id,
            sharingSkillId: row.sharingSkillId,
            ownerId: owner.userId,
            status,
          },
          correlationId: command.context.correlationId,
        });
        return { id, status, version: decided.version };
      },
      async (tx) => {
        await this.actors.require(tx, command.principal, permission, [
          owner.userId,
        ]);
      },
    );
    return verificationView(await this.repository.get(result.value.id));
  }
  async revoke(
    command: SkillCommand,
    id: string,
    evidenceId: string,
    reasonInput: string,
  ) {
    const initial = await this.repository.get(id);
    const owner = await this.sharing.read(initial.sharingSkillId);
    const reason = text(reasonInput, 10, 500);
    const result = await this.commands.execute(
      {
        scope: command.principal.userId,
        operation: "skill-verification:revoke",
        key: command.key,
        command: commandJson({ id, evidenceId, reason }),
      },
      async (tx) => {
        const actor = await this.actors.require(
          tx,
          command.principal,
          "skill-verification:revoke",
          [owner.userId],
        );
        // Archived sharing skills retain moderation history and can still have evidence revoked.
        await this.sharing.lock(tx, initial.sharingSkillId);
        const row = await this.repository.get(id, tx, true);
        const file = row.skillEvidenceSubmissionRecords.find(
          (item) => item.id === evidenceId,
        );
        if (!file) throw new NotFoundException();
        if (file.approvalStatus !== "APPROVED")
          throw new ConflictException("EVIDENCE_NOT_APPROVED");
        await this.repository.revoke(tx, evidenceId, actor.userId, reason);
        await this.aggregate(tx, row.sharingSkillId, owner.userId);
        await this.audit.append(tx, {
          actor: auditActorFromActor(actor),
          action: "VERIFY_SKILL_REVOKE",
          target: { type: "SKILL_EVIDENCE", id: evidenceId },
          before: { status: "APPROVED" },
          after: { status: "REVOKED" },
          reason,
          context: command.context,
        });
        await this.outbox.append(tx, {
          eventId: randomUUID(),
          type: "skill.evidence.revoked",
          version: 1,
          payload: {
            evidenceId,
            verificationId: id,
            sharingSkillId: row.sharingSkillId,
            ownerId: owner.userId,
          },
          correlationId: command.context.correlationId,
        });
        return { id, status: "REVOKED" };
      },
      async (tx) => {
        await this.actors.require(
          tx,
          command.principal,
          "skill-verification:revoke",
          [owner.userId],
        );
      },
    );
    return verificationView(await this.repository.get(result.value.id));
  }
  async download(
    principal: Principal,
    sharingSkillId: string | undefined,
    verificationId: string | undefined,
    evidenceId: string,
  ) {
    // Resolve evidence only through the declared owner or reviewer resource.
    const row = verificationId
      ? await this.repository.get(verificationId)
      : await this.repository.forEvidence(evidenceId);
    const file = row.skillEvidenceSubmissionRecords.find(
      (item) => item.id === evidenceId,
    );
    if (!file?.storedFileId) throw new NotFoundException();
    const actor = await this.transactions.run((tx) =>
      this.actors.require(tx, principal),
    );
    const result = await this.storage.issueDownload(
      {
        actor,
        fileId: file.storedFileId,
        resource: { type: "SKILL_EVIDENCE", id: evidenceId },
      },
      {
        assertRead: async () => {
          await this.transactions.run(async (tx) => {
            if (sharingSkillId) {
              if (row.sharingSkillId !== sharingSkillId)
                throw new NotFoundException();
              await this.own(tx, principal, sharingSkillId);
            } else
              await this.actors.require(
                tx,
                principal,
                "skill-verification:read",
              );
            await this.attachments.assertBoundReady(tx, file.storedFileId!, {
              type: "SKILL_EVIDENCE",
              id: evidenceId,
            });
          });
        },
      },
    );
    return { url: result.url, expiresAt: result.expiresAt.toISOString() };
  }
  async notificationSummary(id: string) {
    const row = await this.repository.get(id);
    const sharing = await this.sharing.read(row.sharingSkillId);
    return {
      verificationId: id,
      ownerId: sharing.userId,
      sharingSkillId: sharing.id,
      status: row.status,
    };
  }
  private async aggregate(tx: TransactionContext, id: string, userId: string) {
    await this.sharing.setVerification(
      tx,
      id,
      await this.repository.badge(tx, id),
    );
    await this.sharing.refreshCounter(tx, userId);
  }
}
