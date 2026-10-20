import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ConversationResponse } from "../../../conversations/presentation/http/conversations.responses";
export class ProposalResponse {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty({ enum: ["LEARNING_REQUEST", "DIRECT_SEARCH"] })
  sourceType!: string;
  @ApiProperty({ type: String, nullable: true, format: "uuid" })
  learningRequestId!: string | null;
  @ApiProperty({ format: "uuid" }) proposerId!: string;
  @ApiProperty({ format: "uuid" }) recipientId!: string;
  @ApiProperty({ format: "uuid" }) skillId!: string;
  @ApiProperty() message!: string;
  @ApiProperty({ type: String, enum: ["ONE_WAY", "TWO_WAY"], nullable: true })
  exchangeTypeHint!: string | null;
  @ApiProperty({ type: String, nullable: true, example: "20.00" })
  proposedCredit!: string | null;
  @ApiProperty({ type: Number, nullable: true }) proposedDurationMinutes!:
    number | null;
  @ApiProperty({ type: Number, nullable: true }) initialSessionCount!:
    number | null;
  @ApiProperty({
    type: String,
    nullable: true,
    example: "Tối Thứ 5 và Thứ 7",
    description: "Free-text schedule suggestion, not a confirmed schedule",
  })
  candidateSlots!: string | null;
  @ApiProperty({
    enum: ["PENDING", "ACCEPTED", "REJECTED", "WITHDRAWN", "EXPIRED"],
  })
  status!: string;
  @ApiProperty({ type: Number }) version!: number;
  @ApiProperty({ type: String, format: "date-time" }) expiresAt!: Date;
  @ApiProperty({ type: String, format: "date-time" }) createdAt!: Date;
  @ApiProperty({ type: String, format: "date-time" }) updatedAt!: Date;
  @ApiPropertyOptional({ format: "uuid" }) conversationId?: string;
}
export class AcceptedProposalResponse {
  @ApiProperty({ type: ProposalResponse }) proposal!: ProposalResponse;
  @ApiProperty({ type: ConversationResponse })
  conversation!: ConversationResponse;
}
