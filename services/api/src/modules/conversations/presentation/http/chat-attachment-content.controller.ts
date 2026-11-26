import { Controller, Get, Header, Query, StreamableFile } from "@nestjs/common";
import { ChatDownloadTicketService } from "../../application/services/chat-download-ticket.service";
import { ConversationsService } from "../../application/services/conversations.service";

@Controller({ path: "chat-attachment-content", version: "1" })
export class ChatAttachmentContentController {
  constructor(
    private readonly tickets: ChatDownloadTicketService,
    private readonly conversations: ConversationsService,
  ) {}

  @Get()
  @Header("Cache-Control", "private, no-store")
  async content(@Query("ticket") ticket: unknown) {
    const { principal, target } = await this.tickets.read(ticket);
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
