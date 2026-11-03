import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
export class ConversationResponse {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty({ format: "uuid" }) proposalId!: string;
  @ApiProperty({ type: String, nullable: true, format: "uuid" })
  learningRequestId!: string | null;
  @ApiProperty({ format: "uuid" }) participantAId!: string;
  @ApiProperty({ format: "uuid" }) participantBId!: string;
  @ApiProperty({ type: String, format: "date-time" }) createdAt!: Date;
}
export class MessageAttachmentResponse {
  @ApiProperty({ format: "uuid" }) attachmentId!: string;
  @ApiProperty({ format: "uuid" }) fileId!: string;
  @ApiProperty() filename!: string;
  @ApiProperty() mimeType!: string;
  @ApiProperty({ type: Number }) fileSizeBytes!: number;
  @ApiProperty() downloadUrlEndpoint!: string;
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
export class ChatFileStatusResponse {
  @ApiProperty({ format: "uuid" }) fileId!: string;
  @ApiProperty() state!: string;
  @ApiProperty({ type: Number }) generation!: number;
}
export class ChatDownloadResponse {
  @ApiProperty() url!: string;
  @ApiProperty({ type: String, format: "date-time" }) expiresAt!: Date;
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
}
