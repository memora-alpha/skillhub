import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import type { Response } from "express";
import {
  CurrentIdentity,
  IdentityGuard,
  type IdentityRequest,
} from "../../../shared/auth/identity.guard";
import { getOrCreateRequestContext } from "../../../shared/http/request-context";
import { success, paginated } from "../../../shared/http/response";
import type { Principal } from "../../auth/application/services/sessions.service";
import { ConversationsService } from "../application/conversations.service";
import {
  ApiSuccessResponse,
  ApiErrorResponse,
} from "../../../shared/http/api-response.decorators";
import {
  ConversationResponse,
  MessageResponse,
  DeliveredMessageResponse,
  PendingMessageResponse,
  ReadStateResponse,
  ChatFileUploadResponse,
  ChatFileStatusResponse,
  ChatDownloadResponse,
} from "./conversations.responses";
import {
  ConversationQueryDto,
  MessageQueryDto,
  ReadConversationDto,
  SendMessageDto,
} from "./conversations.dto";
@ApiTags("conversations")
@ApiBearerAuth()
@UseGuards(IdentityGuard)
@ApiErrorResponse(400)
@ApiErrorResponse(401)
@ApiErrorResponse(403)
@ApiErrorResponse(404)
@ApiErrorResponse(409)
@ApiErrorResponse(429)
@ApiErrorResponse(503)
@Controller({ path: "conversations", version: "1" })
export class ConversationsController {
  constructor(private readonly conversations: ConversationsService) {}
  @Get()
  @ApiSuccessResponse(200, ConversationResponse, { paginated: true })
  @ApiOperation({ summary: "List participant Conversations" })
  async list(
    @CurrentIdentity() actor: Principal,
    @Query() query: ConversationQueryDto,
  ) {
    const result = await this.conversations.list(actor, query);
    return paginated(result.data, result.pagination);
  }
  @Get(":id")
  @ApiSuccessResponse(200, ConversationResponse)
  @ApiOperation({ summary: "Read participant Conversation metadata" })
  async get(
    @CurrentIdentity() actor: Principal,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return success(await this.conversations.get(actor, id));
  }
  @Get(":id/messages")
  @ApiSuccessResponse(200, MessageResponse, { paginated: true })
  @ApiOperation({
    summary: "Published message history; forward recovery uses afterSequence",
  })
  async history(
    @CurrentIdentity() actor: Principal,
    @Param("id", ParseUUIDPipe) id: string,
    @Query() query: MessageQueryDto,
  ) {
    const result = await this.conversations.history(actor, id, query);
    return paginated(result.data, result.pagination);
  }
  @Post(":id/messages")
  @ApiSuccessResponse(201, DeliveredMessageResponse)
  @ApiSuccessResponse(202, PendingMessageResponse)
  @ApiOperation({
    summary: "Send immutable text/files using clientMessageId idempotency",
  })
  async send(
    @CurrentIdentity() actor: Principal,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: SendMessageDto,
    @Req() req: IdentityRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.conversations.send(
      actor,
      id,
      input,
      getOrCreateRequestContext(req),
    );
    res.status(result.deliveryStatus === "DELIVERED" ? 201 : 202);
    return success(result);
  }
  @Get(":id/message-deliveries/:clientMessageId")
  @ApiSuccessResponse(200, [DeliveredMessageResponse, PendingMessageResponse])
  async delivery(
    @CurrentIdentity() actor: Principal,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("clientMessageId", ParseUUIDPipe) clientMessageId: string,
  ) {
    return success(
      await this.conversations.delivery(actor, id, clientMessageId),
    );
  }
  @Post(":id/read")
  @ApiSuccessResponse(200, ReadStateResponse)
  @HttpCode(200)
  async read(
    @CurrentIdentity() actor: Principal,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: ReadConversationDto,
  ) {
    return success(await this.conversations.read(actor, id, body.messageId));
  }
  @Post(":id/attachments")
  @ApiSuccessResponse(202, ChatFileUploadResponse)
  @ApiErrorResponse(413)
  @ApiErrorResponse(415)
  @HttpCode(202)
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      required: ["file"],
      properties: { file: { type: "string", format: "binary" } },
    },
  })
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: 15_000_000, files: 1, fields: 0 },
    }),
  )
  async upload(
    @CurrentIdentity() actor: Principal,
    @Param("id", ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() req: IdentityRequest,
  ) {
    if (!file) throw new BadRequestException("FILE_REQUIRED");
    return success(
      await this.conversations.upload(
        actor,
        id,
        file,
        getOrCreateRequestContext(req),
      ),
    );
  }
  @Get(":id/attachments/:fileId/status")
  @ApiSuccessResponse(200, ChatFileStatusResponse)
  async fileStatus(
    @CurrentIdentity() actor: Principal,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("fileId", ParseUUIDPipe) fileId: string,
  ) {
    return success(
      await this.conversations.attachmentStatus(actor, id, fileId),
    );
  }
  @Get(":id/messages/:messageId/attachments/:attachmentId/download")
  @ApiSuccessResponse(200, ChatDownloadResponse)
  async download(
    @CurrentIdentity() actor: Principal,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("messageId", ParseUUIDPipe) messageId: string,
    @Param("attachmentId", ParseUUIDPipe) attachmentId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader("Cache-Control", "private, no-store");
    return success(
      await this.conversations.download(actor, id, messageId, attachmentId),
    );
  }
}
