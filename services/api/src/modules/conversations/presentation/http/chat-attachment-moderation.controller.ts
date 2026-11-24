import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { IsOptional, IsString, IsUUID, Length, Matches } from "class-validator";
import { TransactionRunner } from "../../../../infrastructure/database/transaction-runner";
import {
  CurrentIdentity,
  IdentityGuard,
} from "../../../../shared/auth/identity.guard";
import { success } from "../../../../shared/http/response";
import { AuditService } from "../../../audit/application/services/audit.service";
import type { Principal } from "../../../auth/application/services/sessions.service";
import { SkillActorService } from "../../../users/application/services/skill-actor.service";

class ModerationQueueQuery {
  @IsOptional()
  @IsUUID()
  before?: string;
}

class RevokeChatAttachmentDto {
  @IsString()
  @Length(1, 500)
  @Matches(/\S/u)
  reason!: string;
}

type QueueRow = {
  fileId: string;
  messageId: string;
  conversationId: string;
  uploaderId: string;
  mimeType: string;
  outcome: "BLOCK" | "REVIEW" | "FAILED";
  reasonCodes: string[] | null;
};
const permission = "chat-attachment:moderate";

@ApiTags("chat-attachment-moderation")
@ApiBearerAuth()
@UseGuards(IdentityGuard)
@Controller({ path: "content-moderation/chat-attachments", version: "1" })
export class ChatAttachmentModerationController {
  constructor(
    private readonly transactions: TransactionRunner,
    private readonly actors: SkillActorService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  async list(
    @CurrentIdentity() principal: Principal,
    @Query() query: ModerationQueueQuery,
  ) {
    const rows = await this.transactions.run(async (tx) => {
      await this.actors.require(tx, principal, permission);
      return tx.$queryRaw<QueueRow[]>`
        SELECT f.id AS "fileId", p.id AS "messageId", p.conversation_id AS "conversationId",
          f.uploaded_by AS "uploaderId", f.detected_mime AS "mimeType",
          f.moderation_assessment ->> 'outcome' AS outcome,
          f.moderation_assessment -> 'reasonCodes' AS "reasonCodes"
        FROM stored_files f JOIN chat_publications p ON p.id = f.resource_id
        WHERE p.status = 'DELIVERED' AND f.purpose = 'CHAT' AND f.resource_type = 'CHAT_MESSAGE'
          AND f.moderation_assessment ->> 'outcome' IN ('BLOCK', 'REVIEW', 'FAILED')
          AND (${query.before ?? null}::uuid IS NULL OR f.id < ${query.before ?? null}::uuid)
        ORDER BY f.id DESC LIMIT 51`;
    });
    const items = rows.slice(0, 50);
    return success({
      items,
      nextCursor: rows.length > 50 ? items.at(-1)?.fileId : null,
    });
  }

  @Post(":fileId/revoke")
  async revoke(
    @CurrentIdentity() principal: Principal,
    @Param("fileId", ParseUUIDPipe) fileId: string,
    @Body() input: RevokeChatAttachmentDto,
  ) {
    return success(
      await this.transactions.run(async (tx) => {
        const actor = await this.actors.require(tx, principal, permission);
        await tx.$queryRaw`SELECT id FROM stored_files WHERE id = ${fileId}::uuid FOR UPDATE`;
        const file = await tx.storedFile.findUnique({ where: { id: fileId } });
        const assessment = file?.moderationAssessment;
        if (
          file?.purpose !== "CHAT" ||
          file.resourceType !== "CHAT_MESSAGE" ||
          !file.resourceId ||
          !assessment ||
          typeof assessment !== "object" ||
          Array.isArray(assessment) ||
          !["BLOCK", "REVIEW", "FAILED"].includes(String(assessment.outcome)) ||
          !(await tx.chatPublication.findFirst({
            where: { id: file.resourceId, status: "DELIVERED" },
          }))
        )
          throw new NotFoundException();
        if (assessment.outcome === "BLOCK")
          return { fileId, availability: "REVOKED" };
        await tx.storedFile.update({
          where: { id: fileId },
          data: {
            moderationAssessment: {
              ...assessment,
              outcome: "BLOCK",
              enforced: true,
              reasonCodes: ["STAFF_CONFIRMED"],
            },
          },
        });
        await this.audit.append(tx, {
          actorId: actor.userId,
          actorRole: actor.roles.includes("ADMIN") ? "ADMIN" : "STAFF",
          action: "CHAT_ATTACHMENT_REVOKED",
          targetType: "STORED_FILE",
          targetId: fileId,
          reason: input.reason.trim(),
          before: { outcome: String(assessment.outcome) },
          after: { outcome: "BLOCK" },
        });
        return { fileId, availability: "REVOKED" };
      }),
    );
  }
}
