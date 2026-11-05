import { ApiProperty } from "@nestjs/swagger";

export class LearningPathSummaryResponse {
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
  @ApiProperty({ type: String, enum: ["ONE_WAY", "TWO_WAY"], nullable: true })
  exchangeType!: string | null;
  @ApiProperty({ format: "uuid" }) counterpartId!: string;
  @ApiProperty() currentVersion!: number;
  @ApiProperty({ type: Number, nullable: true }) lockedVersion!: number | null;
  @ApiProperty({ format: "date-time" }) createdAt!: string;
  @ApiProperty({ format: "date-time" }) updatedAt!: string;
}
