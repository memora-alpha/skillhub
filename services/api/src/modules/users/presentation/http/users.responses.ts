import { ApiProperty } from "@nestjs/swagger";
export class PublicProfileResponse {
  @ApiProperty({
    type: Object,
    description: "Visible sharing skills preview with cursor pagination",
  })
  sharingSkills!: unknown;
  @ApiProperty({ format: "uuid" }) userId!: string;
  @ApiProperty() fullName!: string;
  @ApiProperty() headline!: string;
  @ApiProperty() bio!: string;
  @ApiProperty({ type: String, nullable: true }) avatarUrl!: string | null;
  @ApiProperty({ type: Number }) reputationScore!: number;
  @ApiProperty() verifiedSkillCount!: number;
  @ApiProperty() completedSessionCount!: number;
  @ApiProperty({ type: String, nullable: true }) selectedTitle!: string | null;
}
export class OwnProfileResponse extends PublicProfileResponse {
  @ApiProperty({ type: String, nullable: true }) timezone!: string | null;
  @ApiProperty({ enum: ["vi", "en"] }) locale!: string;
}
export class OwnIdentityResponse {
  @ApiProperty({ format: "uuid" }) userId!: string;
  @ApiProperty({ format: "email" }) email!: string;
  @ApiProperty() emailVerified!: boolean;
  @ApiProperty({
    enum: [
      "PENDING_VERIFICATION",
      "ACTIVE",
      "LOCKED",
      "SUSPENDED",
      "DEACTIVATED",
    ],
  })
  accountStatus!: string;
  @ApiProperty({
    type: [String],
    minItems: 1,
    maxItems: 1,
    description: "The account's one assigned role",
  })
  roles!: string[];
  @ApiProperty({ type: OwnProfileResponse }) profile!: OwnProfileResponse;
}
export class AvatarResponse {
  @ApiProperty({ format: "uuid" }) assetId!: string;
  @ApiProperty({ enum: ["QUARANTINED", "CLEAN", "REJECTED", "DELETED"] })
  status!: string;
}
export class AdminUserResponse {
  @ApiProperty({ format: "uuid" }) userId!: string;
  @ApiProperty() fullName!: string;
  @ApiProperty() maskedEmail!: string;
  @ApiProperty() accountStatus!: string;
  @ApiProperty({
    type: [String],
    minItems: 1,
    maxItems: 1,
    description: "The account's one assigned role",
  })
  roles!: string[];
  @ApiProperty({ format: "date-time" }) createdAt!: string;
}
