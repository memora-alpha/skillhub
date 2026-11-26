import {
  Controller,
  Get,
  Header,
  Query,
  StreamableFile,
  UseGuards,
} from "@nestjs/common";
import {
  CurrentIdentity,
  IdentityGuard,
} from "../../../../shared/auth/identity.guard";
import type { Principal } from "../../../auth/application/services/sessions.service";
import { ChatDownloadTicketService } from "../../application/services/chat-download-ticket.service";
import { ConversationsService } from "../../application/services/conversations.service";

@Controller({ path: "chat-attachment-content", version: "1" })
@UseGuards(IdentityGuard)
export class ChatAttachmentContentController {
  constructor(
    private readonly tickets: ChatDownloadTicketService,
    private readonly conversations: ConversationsService,
  ) {}

  @Get()
  @Header("Cache-Control", "private, no-store")
  @Header("X-Content-Type-Options", "nosniff")
  async content(
    @CurrentIdentity() principal: Principal,
    @Query("ticket") ticket: unknown,
  ) {
    const target = await this.tickets.read(ticket, principal);
    const { stream, filename, size } = await this.conversations.downloadContent(
      principal,
      target.conversationId,
      target.messageId,
      target.attachmentId,
    );
    return new StreamableFile(stream, {
      type: "application/octet-stream",
      disposition: `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      length: size,
    });
  }
}
