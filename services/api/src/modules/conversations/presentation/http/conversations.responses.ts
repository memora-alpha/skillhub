import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
export class ConversationResponse {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty({ format: "uuid" }) proposalId!: string;
  @ApiProperty({ type: String, nullable: true, format: "uuid" })
  learningRequestId!: string | null;
  @ApiProperty({ format: "uuid" }) participantAId!: string;
  @ApiProperty({ format: "uuid" }) participantBId!: string;
  @ApiProperty({ type: String, format: "date-time" }) createdAt!: Date;
  @ApiProperty({ type: String, format: "date-time" }) lastActivityAt!: Date;
}
export class ChatAttachmentMetadataResponse {
  @ApiProperty({ enum: ["IMAGE", "DOCUMENT"] }) attachmentType!: string;
  @ApiProperty({ type: Number, nullable: true }) width!: number | null;
  @ApiProperty({ type: Number, nullable: true }) height!: number | null;
  @ApiProperty({
    enum: ["PENDING_SCAN", "AVAILABLE", "REVOKED", "UNAVAILABLE"],
  })
  accessStatus!: string;
  @ApiProperty({
    enum: ["PENDING", "APPROVED", "REVIEW_REQUIRED", "BLOCKED", "FAILED"],
  })
  moderationStatus!: string;
}
export class MessageAttachmentResponse extends ChatAttachmentMetadataResponse {
  @ApiProperty({ format: "uuid" }) attachmentId!: string;
  @ApiProperty({ format: "uuid" }) fileId!: string;
  @ApiProperty() filename!: string;
  @ApiProperty() mimeType!: string;
  @ApiProperty({ type: Number }) fileSizeBytes!: number;
  @ApiProperty() downloadUrlEndpoint!: string;
  @ApiPropertyOptional() previewUrlEndpoint?: string;
  @ApiPropertyOptional() thumbnailUrlEndpoint?: string;
  @ApiPropertyOptional({
    enum: ["PENDING_SCAN", "AVAILABLE", "REVOKED", "UNAVAILABLE"],
  })
  availability?: string;
}
export class MessageResponse {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty({ format: "uuid" }) conversationId!: string;
  @ApiProperty({ format: "uuid" }) senderId!: string;
  @ApiProperty({ maxLength: 2000 }) messageText!: string;
  @ApiProperty({ enum: ["TEXT", "FILE", "SYSTEM"] }) messageType!: string;
  @ApiProperty({ type: [MessageAttachmentResponse] })
  attachments!: MessageAttachmentResponse[];
  @ApiProperty({ type: String, example: "9007199254740993" }) sequence!: string;
  @ApiProperty({ type: String, format: "date-time" }) sentAt!: Date;
  @ApiProperty({ type: String, nullable: true, format: "date-time" })
  readAt!: Date | null;
  @ApiPropertyOptional() objectType?: string;
  @ApiPropertyOptional({ format: "uuid" }) objectId?: string;
  @ApiPropertyOptional({ type: Number }) objectVersion?: number;
}
export class DeliveredMessageResponse {
  @ApiProperty({ enum: ["DELIVERED"] }) deliveryStatus!: string;
  @ApiProperty({ type: MessageResponse }) message!: MessageResponse;
}
export class PendingMessageResponse {
  @ApiProperty({ enum: ["PREPARING", "PENDING"] }) deliveryStatus!: string;
  @ApiProperty({ format: "uuid" }) messageId!: string;
  @ApiProperty({ format: "uuid" }) clientMessageId!: string;
  @ApiProperty() statusUrl!: string;
  @ApiProperty({ type: String, nullable: true }) failureCode!: string | null;
}
export class ReadStateResponse {
  @ApiProperty({ type: String }) lastReadSequence!: string;
  @ApiProperty({ type: String, format: "date-time" }) lastReadAt!: Date;
}
export class ChatFileUploadResponse {
  @ApiProperty({ format: "uuid" }) fileId!: string;
  @ApiProperty({ enum: ["QUARANTINED"] }) state!: string;
}
export class ChatFileStatusResponse extends ChatAttachmentMetadataResponse {
  @ApiProperty({ format: "uuid" }) fileId!: string;
  @ApiProperty() state!: string;
  @ApiProperty({ type: Number }) generation!: number;
  @ApiProperty() canAttach!: boolean;
  @ApiProperty({ type: String, nullable: true }) mimeType!: string | null;
  @ApiProperty({ type: Number, nullable: true }) fileSizeBytes!: number | null;
  @ApiPropertyOptional({
    enum: ["PENDING_SCAN", "AVAILABLE", "REVOKED", "UNAVAILABLE"],
  })
  availability?: string;
}
export class ChatDownloadResponse {
  @ApiProperty() url!: string;
  @ApiProperty({ type: String, format: "date-time" }) expiresAt!: Date;
}

export class InboxLatestMessageResponse {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty({ format: "uuid" }) conversationId!: string;
  @ApiProperty({ format: "uuid" }) senderId!: string;
  @ApiProperty({ enum: ["TEXT", "FILE", "SYSTEM"] }) messageType!: string;
  @ApiProperty({ maxLength: 160 }) preview!: string;
  @ApiProperty({ type: String, format: "date-time" }) sentAt!: Date;
}

export class InboxGroupResponse {
  @ApiProperty({
    description: "Stable request:<uuid> or conversation:<uuid> group key",
  })
  id!: string;
  @ApiProperty({ enum: ["LEARNING_REQUEST", "DIRECT_CONVERSATION"] })
  groupType!: string;
  @ApiProperty({ type: String, format: "uuid", nullable: true })
  learningRequestId!: string | null;
  @ApiProperty({ type: String, format: "uuid", nullable: true })
  conversationId!: string | null;
  @ApiProperty({ type: String, nullable: true }) title!: string | null;
  @ApiProperty({ enum: ["OWNER", "PROPOSER", "PARTICIPANT"] })
  viewerRole!: string;
  @ApiProperty({
    type: Number,
    nullable: true,
    description: "All received proposal history; owner only, otherwise null",
  })
  receivedProposalCount!: number | null;
  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      "Only the viewer's sent history; null for direct conversations",
  })
  sentProposalCount!: number | null;
  @ApiProperty({
    description:
      "Total conversations accessible to the viewer, independent of chat pagination",
  })
  conversationCount!: number;
  @ApiProperty({ type: String, format: "date-time" }) lastActivityAt!: Date;
  @ApiProperty({ type: InboxLatestMessageResponse, nullable: true })
  latestMessage!: InboxLatestMessageResponse | null;
  @ApiProperty({
    description:
      "Any published incoming message beyond the viewer's read watermark across all accessible chats in this group",
  })
  hasUnread!: boolean;
}
