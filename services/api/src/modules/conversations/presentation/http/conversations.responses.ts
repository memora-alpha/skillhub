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
export class ConversationPartnerResponse {
  @ApiProperty({ format: "uuid" }) userId!: string;
  @ApiProperty() fullName!: string;
  @ApiProperty({ type: String, nullable: true }) avatarUrl!: string | null;
}
export class MessageSenderResponse {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty({ type: String, nullable: true }) fullName!: string | null;
  @ApiProperty({ type: String, nullable: true }) avatarUrl!: string | null;
}
export class ConversationPreviewResponse {
  @ApiProperty({ type: MessageSenderResponse }) sender!: MessageSenderResponse;
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty({ format: "uuid" }) senderId!: string;
  @ApiProperty() messageText!: string;
  @ApiProperty({ enum: ["TEXT", "FILE", "SYSTEM"] }) messageType!: string;
  @ApiProperty() sequence!: string;
  @ApiProperty({ type: String, nullable: true, format: "date-time" })
  sentAt!: Date | null;
  @ApiProperty() attachmentCount!: number;
}
export class ConversationInboxResponse extends ConversationResponse {
  @ApiProperty({ type: String, format: "date-time" }) lastActivityAt!: Date;
  @ApiProperty({ type: ConversationPartnerResponse, nullable: true })
  partner!: ConversationPartnerResponse | null;
  @ApiProperty({ type: String, nullable: true }) topic!: string | null;
  @ApiProperty() summaryAvailable!: boolean;
  @ApiProperty({ type: ConversationPreviewResponse, nullable: true })
  lastMessage!: ConversationPreviewResponse | null;
  @ApiProperty({ type: Number, nullable: true }) unreadCount!: number | null;
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
  @ApiProperty({ type: MessageSenderResponse }) sender!: MessageSenderResponse;
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
