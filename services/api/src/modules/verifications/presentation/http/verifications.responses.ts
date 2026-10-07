import { ApiProperty } from "@nestjs/swagger";
export class EvidenceResponse {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty({ nullable: true, type: String }) title!: string | null;
  @ApiProperty({ nullable: true, type: String }) description!: string | null;
  @ApiProperty() mimeType!: string;
  @ApiProperty({
    type: String,
    description: "Integer byte count as a decimal string",
  })
  fileSizeBytes!: string;
  @ApiProperty({ enum: ["PENDING", "APPROVED", "REJECTED", "REVOKED"] })
  approvalStatus!: string;
  @ApiProperty({ nullable: true, type: String, format: "date-time" })
  approvedAt!: string | null;
  @ApiProperty({ nullable: true, type: String }) reviewerId!: string | null;
  @ApiProperty({ nullable: true, type: String, format: "date-time" })
  reviewedAt!: string | null;
  @ApiProperty({ nullable: true, type: String }) rejectReason!: string | null;
  @ApiProperty({ nullable: true, type: String, format: "date-time" })
  revokedAt!: string | null;
  @ApiProperty({ nullable: true, type: String }) revokedReason!: string | null;
  @ApiProperty({ nullable: true, type: String }) revokedByUserId!:
    string | null;
}
export class VerificationResponse {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty({ format: "uuid" }) sharingSkillId!: string;
  @ApiProperty({ enum: ["PENDING", "APPROVED", "REJECTED"] }) status!: string;
  @ApiProperty() version!: number;
  @ApiProperty({ nullable: true, type: String }) reviewerId!: string | null;
  @ApiProperty({ nullable: true, type: String, format: "date-time" })
  reviewedAt!: string | null;
  @ApiProperty({ nullable: true, type: String }) rejectReason!: string | null;
  @ApiProperty({ nullable: true, type: String }) note!: string | null;
  @ApiProperty({ format: "date-time" }) submittedAt!: string;
  @ApiProperty({ type: [EvidenceResponse] }) files!: EvidenceResponse[];
}
export class FileStatusResponse {
  @ApiProperty({ format: "uuid" }) fileId!: string;
  @ApiProperty() state!: string;
  @ApiProperty({ required: false }) generation?: number;
}
export class EvidenceDownloadResponse {
  @ApiProperty() url!: string;
  @ApiProperty({ format: "date-time" }) expiresAt!: string;
}
