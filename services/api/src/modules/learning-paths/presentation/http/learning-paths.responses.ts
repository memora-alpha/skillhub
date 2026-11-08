import { ApiProperty } from "@nestjs/swagger";

export class LearningPathSummaryResponse {
  @ApiProperty({
    type: String,
    nullable: true,
    enum: [
      "PREPARING",
      "WAITING_START",
      "LEARNING",
      "LEARNING_FINISHED",
      "COMPLETED",
      "STOPPED",
    ],
  })
  learningStage!: string | null;
  @ApiProperty({ type: String, nullable: true }) stageReasonCode!:
    string | null;
  @ApiProperty({
    type: Object,
    description:
      "Learning/teaching completed and total counts, with the agreement version basis",
  })
  progress!: object;
  @ApiProperty({ type: Object, nullable: true }) nextSession!: object | null;
  @ApiProperty({ type: Number, minimum: 0 }) attentionCount!: number;
  @ApiProperty({ type: Object, nullable: true }) primaryAttention!:
    object | null;
  @ApiProperty({ type: Object }) primaryAction!: object;
  @ApiProperty({ type: Object }) settlement!: object;
  @ApiProperty({ format: "date-time" }) evaluatedAt!: string;
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty({
    type: String,
    nullable: true,
    description:
      "Related Learning Request title, or skill name for a direct connection; null when source metadata is unavailable.",
  })
  title!: string | null;
  @ApiProperty({ format: "uuid" }) conversationId!: string;
  @ApiProperty() status!: string;
  @ApiProperty({
    type: String,
    format: "date-time",
    nullable: true,
    description:
      "New learning obligations stop at this approval time; Credit may still await existing outcomes.",
  })
  terminationApprovedAt!: string | null;
  @ApiProperty({ type: String, enum: ["ONE_WAY", "TWO_WAY"], nullable: true })
  exchangeType!: string | null;
  @ApiProperty({ format: "uuid" }) counterpartId!: string;
  @ApiProperty() currentVersion!: number;
  @ApiProperty({ type: Number, nullable: true }) lockedVersion!: number | null;
  @ApiProperty({ format: "date-time" }) createdAt!: string;
  @ApiProperty({ format: "date-time" }) updatedAt!: string;
}
