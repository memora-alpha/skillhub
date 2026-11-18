import { ApiProperty } from "@nestjs/swagger";

export class AuditLogResponse {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty({ type: String, nullable: true }) actorKind!: string | null;
  @ApiProperty({ type: String, format: "uuid", nullable: true }) actorId!:
    string | null;
  @ApiProperty({
    type: String,
    nullable: true,
    description: "Historical single-role snapshot",
  })
  actorRole!: string | null;
  @ApiProperty({ type: [String] }) actorRoles!: string[];
  @ApiProperty({ type: String, nullable: true }) systemActor!: string | null;
  @ApiProperty() action!: string;
  @ApiProperty() targetType!: string;
  @ApiProperty() targetId!: string;
  @ApiProperty({ type: String, nullable: true }) reason!: string | null;
  @ApiProperty({ format: "date-time" }) createdAt!: string;
  @ApiProperty({ type: String, nullable: true }) requestId!: string | null;
  @ApiProperty({ type: String, format: "uuid", nullable: true })
  correlationId!: string | null;
}
