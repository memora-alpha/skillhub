import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { createHash, randomUUID } from "node:crypto";
import { TransactionRunner } from "../../../../infrastructure/database/transaction-runner";
import type { Principal } from "../../../auth/application/services/sessions.service";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import { SkillActorService } from "../../../users/application/services/skill-actor.service";
import { ReportSupportService } from "./report-support.service";
import { CaseMessageRepository } from "../../infrastructure/persistence/case-message.repository";
import {
  assertPrivateCaseThread,
  OPEN_REPORT_STATUSES,
} from "../../domain/report-support.policy";
import { z } from "zod";
import { FileAttachmentService } from "../../../../infrastructure/storage/file-attachment.service";
import { FileStorageService } from "../../../../infrastructure/storage/file-storage.service";
import { storageActor } from "../../../../shared/authorization/principal-actor";

@Injectable()
export class CaseMessagesService {
  constructor(
    private readonly transactions: TransactionRunner,
    private readonly actors: SkillActorService,
    private readonly support: ReportSupportService,
    private readonly messages: CaseMessageRepository,
    private readonly attachments?: FileAttachmentService,
    private readonly storage?: FileStorageService,
  ) {}
  async attachEvidence(
    actor: Principal,
    caseId: string,
    partyId: string,
    fileId: string,
  ) {
    return this.transactions.run(async (tx) => {
      await tx.$queryRawUnsafe(
        "SELECT case_id FROM report_cases WHERE case_id=$1::uuid FOR UPDATE",
        caseId,
      );
      const item = await this.access(tx, actor, caseId, partyId);
      if (actor.userId !== partyId)
        throw new ForbiddenException("ONLY_PARTY_MAY_SUBMIT_EVIDENCE");
      const prior = await tx.reportEvidence.findUnique({
        where: { storedFileId: fileId },
      });
      if (prior) {
        if (prior.caseId !== caseId || prior.partyId !== partyId)
          throw new ConflictException("EVIDENCE_ALREADY_BOUND");
        return { id: prior.id };
      }
      if (!OPEN_REPORT_STATUSES.includes(item.status))
        throw new ConflictException("REPORT_CASE_CLOSED");
      if (!this.attachments)
        throw new ServiceUnavailableException("CASE_EVIDENCE_UNAVAILABLE");
      const evidenceCount = await tx.reportEvidence.count({
        where: { caseId, partyId },
      });
      if (evidenceCount >= 5)
        throw new BadRequestException("CASE_EVIDENCE_LIMIT");
      const file = await this.attachments.attachReady(tx, actor, fileId, {
        type: "REPORT_EVIDENCE",
        id: caseId,
        purpose: "REPORT",
      });
      const row = await tx.reportEvidence.create({
        data: {
          id: randomUUID(),
          caseId,
          partyId,
          storedFileId: fileId,
          mimeType: file.mime,
          storageKey: file.key,
          fileSizeBytes: BigInt(file.size),
          uploadedAt: file.uploadedAt,
        },
      });
      if (item.status === "NEED_MORE_INFO")
        await tx.reportCase.update({
          where: { id: caseId },
          data: { status: "UNDER_REVIEW", version: { increment: 1 } },
        });
      await tx.outboxEvent.create({
        data: {
          eventId: randomUUID(),
          aggregateType: "REPORT_CASE",
          aggregateId: caseId,
          version: item.version,
          type: "report.case.evidence",
          payload: {
            caseId,
            partyId,
            senderId: actor.userId,
            evidenceId: row.id,
          },
          dedupeKey: "case-evidence:" + row.id,
          correlationId: randomUUID(),
        },
      });
      return { id: row.id };
    });
  }
  async evidence(actor: Principal, caseId: string, partyId: string) {
    return this.transactions.run(async (tx) => {
      await this.access(tx, actor, caseId, partyId);
      return (
        await tx.reportEvidence.findMany({
          where: { caseId, partyId },
          select: {
            id: true,
            mimeType: true,
            fileSizeBytes: true,
            uploadedAt: true,
          },
          orderBy: { id: "asc" },
        })
      ).map((row) => ({ ...row, fileSizeBytes: row.fileSizeBytes.toString() }));
    });
  }
  async downloadEvidence(
    actor: Principal,
    caseId: string,
    partyId: string,
    evidenceId: string,
  ) {
    const fileId = await this.transactions.run(async (tx) => {
      await this.access(tx, actor, caseId, partyId);
      const row = await tx.reportEvidence.findFirst({
        where: { id: evidenceId, caseId, partyId },
        select: { storedFileId: true, storageKey: true },
      });
      if (!row) throw new NotFoundException("REPORT_EVIDENCE_NOT_FOUND");
      const stored = row.storedFileId
        ? { id: row.storedFileId }
        : await tx.storedFile.findFirst({
            where: {
              objectKey: row.storageKey,
              purpose: "REPORT",
              resourceType: "REPORT_EVIDENCE",
              resourceId: caseId,
            },
            select: { id: true },
          });
      if (!stored) throw new NotFoundException("REPORT_EVIDENCE_NOT_FOUND");
      await this.support.auditEvidenceRead(tx, actor.userId, evidenceId);
      return stored.id;
    });
    if (!this.storage)
      throw new ServiceUnavailableException("CASE_EVIDENCE_UNAVAILABLE");
    return this.storage.issueDownload(
      {
        actor: storageActor(actor),
        fileId,
        resource: { type: "REPORT_EVIDENCE", id: evidenceId },
      },
      {
        assertRead: async () => {
          await this.transactions.run(async (tx) => {
            await this.access(tx, actor, caseId, partyId);
          });
        },
      },
    );
  }
  private async access(
    tx: TransactionContext,
    actor: Principal,
    caseId: string,
    partyId: string,
  ) {
    const live = await this.actors.require(tx, actor);
    const scope = await this.support.parties(tx, caseId);
    assertPrivateCaseThread(
      actor.userId,
      partyId,
      scope.item.handlerId,
      scope.parties,
      live.roles.some((role) => role === "STAFF" || role === "ADMIN") &&
        live.permissions.has("report:communicate") &&
        live.permissions.has("report:moderate") &&
        !live.blockedPermissions.has("report:communicate") &&
        !live.blockedPermissions.has("report:moderate"),
    );
    return scope.item;
  }
  async send(
    actor: Principal,
    caseId: string,
    partyId: string,
    input: { clientMessageId: string; text: string },
  ) {
    if (
      !z.uuid().safeParse(input.clientMessageId).success ||
      typeof input.text !== "string" ||
      !input.text.trim() ||
      input.text.length > 4000
    )
      throw new BadRequestException("INVALID_CASE_MESSAGE");
    const text = input.text.trim();
    const messageId = createHash("sha256")
      .update(
        JSON.stringify([caseId, partyId, actor.userId, input.clientMessageId]),
      )
      .digest("hex");
    const digest = createHash("sha256").update(text).digest("hex");
    await this.transactions.run(async (tx) => {
      await this.access(tx, actor, caseId, partyId);
    });
    // Content is staged outside PostgreSQL; only a committed receipt makes it visible.
    await this.messages.stage({
      _id: messageId,
      caseId,
      partyId,
      senderId: actor.userId,
      digest,
      text,
      createdAt: new Date(),
    });
    return this.transactions.run(async (tx) => {
      await tx.$queryRawUnsafe(
        "SELECT case_id FROM report_cases WHERE case_id=$1::uuid FOR UPDATE",
        caseId,
      );
      const item = await this.access(tx, actor, caseId, partyId);
      const prior = await tx.reportMessageReceipt.findUnique({
        where: { messageId },
      });
      if (prior) {
        if (prior.digest !== digest)
          throw new ConflictException("CASE_MESSAGE_ID_REUSED");
        return { id: messageId, createdAt: prior.createdAt };
      }
      if (!OPEN_REPORT_STATUSES.includes(item.status))
        throw new ConflictException("REPORT_CASE_CLOSED");
      if (!item.handlerId) throw new ConflictException("CASE_HANDLER_REQUIRED");
      const receipt = await tx.reportMessageReceipt.create({
        data: { messageId, caseId, partyId, senderId: actor.userId, digest },
      });
      await tx.outboxEvent.create({
        data: {
          eventId: randomUUID(),
          aggregateType: "REPORT_CASE",
          aggregateId: caseId,
          version: item.version,
          type: "report.case.message",
          payload: {
            caseId,
            partyId,
            senderId: actor.userId,
            handlerId: item.handlerId,
            messageId,
          },
          dedupeKey: "case-message:" + messageId,
          correlationId: randomUUID(),
        },
      });
      // A participant reply returns the case to its handler without closing the dispute.
      if (actor.userId === partyId && item.status === "NEED_MORE_INFO")
        await tx.reportCase.update({
          where: { id: caseId },
          data: { status: "UNDER_REVIEW", version: { increment: 1 } },
        });
      return { id: messageId, createdAt: receipt.createdAt };
    });
  }
  async list(
    actor: Principal,
    caseId: string,
    partyId: string,
    cursor?: string,
    limit = 30,
  ) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100)
      throw new BadRequestException("INVALID_CASE_MESSAGE_LIMIT");
    let boundary: { createdAt: Date; messageId: string } | null = null;
    if (cursor) {
      try {
        if (cursor.length > 1024) throw new Error("size");
        const row = z
          .strictObject({
            caseId: z.uuid(),
            partyId: z.uuid(),
            actorId: z.uuid(),
            at: z.iso.datetime(),
            id: z.string().regex(/^[a-f0-9]{64}$/),
          })
          .parse(JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")));
        if (
          row.caseId !== caseId ||
          row.partyId !== partyId ||
          row.actorId !== actor.userId
        )
          throw new Error("scope");
        boundary = { createdAt: new Date(row.at), messageId: row.id };
      } catch {
        throw new BadRequestException("INVALID_CASE_MESSAGE_CURSOR");
      }
    }
    const receipts = await this.transactions.run(async (tx) => {
      await this.access(tx, actor, caseId, partyId);
      return tx.reportMessageReceipt.findMany({
        where: {
          caseId,
          partyId,
          ...(boundary
            ? {
                OR: [
                  { createdAt: { lt: boundary.createdAt } },
                  {
                    createdAt: boundary.createdAt,
                    messageId: { lt: boundary.messageId },
                  },
                ],
              }
            : {}),
        },
        orderBy: [{ createdAt: "desc" }, { messageId: "desc" }],
        take: limit + 1,
      });
    });
    const page = receipts.slice(0, limit),
      last = page.at(-1);
    const documents = await this.messages.read(page.map((r) => r.messageId));
    const data = page.map((receipt) => {
      const row = documents.find((m) => m._id === receipt.messageId);
      if (!row || row.digest !== receipt.digest)
        throw new ServiceUnavailableException(
          "CASE_MESSAGE_CONTENT_UNAVAILABLE",
        );
      return {
        id: receipt.messageId,
        senderId: receipt.senderId,
        text: row.text,
        createdAt: receipt.createdAt,
      };
    });
    // Recheck assignment/permissions after Mongo I/O, including concurrent revocation.
    await this.transactions.run(async (tx) => {
      await this.access(tx, actor, caseId, partyId);
    });
    return {
      data,
      pagination: {
        limit,
        hasMore: receipts.length > limit,
        nextCursor:
          receipts.length > limit && last
            ? Buffer.from(
                JSON.stringify({
                  caseId,
                  partyId,
                  actorId: actor.userId,
                  at: last.createdAt.toISOString(),
                  id: last.messageId,
                }),
              ).toString("base64url")
            : null,
      },
    };
  }
}
