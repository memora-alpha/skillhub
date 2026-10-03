import { ApiProperty } from "@nestjs/swagger";
export class PublicProfileResponse {
  @ApiProperty({ format: "uuid" }) userId!: string;
  @ApiProperty() fullName!: string;
  @ApiProperty() headline!: string;
  @ApiProperty() bio!: string;
  @ApiProperty({ type: String, nullable: true }) avatarUrl!: string | null;
  @ApiProperty({ type: Number, nullable: true }) reputationScore!:
    number | null;
  @ApiProperty() verifiedSkillCount!: number;
  @ApiProperty() completedSessionCount!: number;
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
  @ApiProperty({ type: [String] }) roles!: string[];
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
  @ApiProperty({ type: [String] }) roles!: string[];
  @ApiProperty({ format: "date-time" }) createdAt!: string;
}
export class AdminUserListResponse {
  @ApiProperty({ type: [AdminUserResponse] }) items!: AdminUserResponse[];
  @ApiProperty({ type: String, nullable: true }) nextCursor!: string | null;
}
