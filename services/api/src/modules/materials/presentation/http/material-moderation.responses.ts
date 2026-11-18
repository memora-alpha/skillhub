import { ApiProperty } from "@nestjs/swagger";

export class MaterialHistoryActorResponse {
  @ApiProperty({ type: String, nullable: true }) kind!: string | null;
  @ApiProperty({ type: String, format: "uuid", nullable: true }) userId!:
    string | null;
  @ApiProperty({ type: [String] }) roles!: string[];
  @ApiProperty({ type: String, nullable: true }) systemActor!: string | null;
}

export class MaterialModerationHistoryResponse {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty({ enum: ["approve", "reject", "hide", "unhide", "unknown"] })
  action!: string;
  @ApiProperty({ type: MaterialHistoryActorResponse })
  actor!: MaterialHistoryActorResponse;
  @ApiProperty({ format: "date-time" }) occurredAt!: string;
  @ApiProperty({ type: String, nullable: true }) reason!: string | null;
  @ApiProperty({ type: String, nullable: true }) previousStatus!: string | null;
  @ApiProperty({ type: String, nullable: true }) status!: string | null;
  @ApiProperty({ type: "integer", nullable: true }) reviewedListingVersion!:
    number | null;
  @ApiProperty({ type: "integer", nullable: true }) listingVersion!:
    number | null;
}
