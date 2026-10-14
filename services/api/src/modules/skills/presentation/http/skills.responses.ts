import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { SkillLevelResponse } from "./skill-levels.dto";
export class TagResponse {
  @ApiProperty({
    type: String,
    format: "uuid",
    description: "Canonical Tag identifier.",
  })
  id!: string;
  @ApiProperty({
    type: String,
    maxLength: 80,
    description: "Canonical catalog label.",
  })
  label!: string;
}
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
  @ApiProperty({
    description: "Selected catalog code, including custom codes such as B2.",
  })
  level!: string;
  @ApiProperty({ type: String, format: "uuid", nullable: true }) levelId!:
    string | null;
  @ApiProperty({ type: SkillLevelResponse, nullable: true })
  skillLevel!: SkillLevelResponse | null;
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
