import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
export class SkillResponse {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() nameKey!: string;
  @ApiProperty() slug!: string;
  @ApiProperty({ nullable: true, type: String }) categoryId!: string | null;
  @ApiProperty({ nullable: true, type: String }) description!: string | null;
  @ApiProperty({ enum: ["ACTIVE", "INACTIVE", "ARCHIVED"] }) status!: string;
  @ApiProperty() version!: number;
  @ApiProperty({ format: "date-time" }) createdAt!: string;
  @ApiProperty({ format: "date-time" }) updatedAt!: string;
}
export class PublicSharingResponse {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty({ type: SkillResponse }) skill!: SkillResponse;
  @ApiProperty({ enum: ["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"] })
  level!: string;
  @ApiProperty() description!: string;
  @ApiProperty({ type: String, nullable: true }) experienceYears!:
    string | null;
  @ApiProperty({ enum: ["UNVERIFIED", "PENDING", "VERIFIED", "REJECTED"] })
  verificationStatus!: string;
}
export class SharingResponse extends PublicSharingResponse {
  @ApiProperty() isVisible!: boolean;
  @ApiProperty({ type: String, nullable: true, format: "date-time" })
  archivedAt!: string | null;
  @ApiProperty() version!: number;
  @ApiPropertyOptional({ type: Object, nullable: true })
  latestVerification?: unknown;
}
