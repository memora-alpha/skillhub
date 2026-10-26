import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { SkillLevelResponse } from "../../../skills/presentation/http/skill-levels.dto";
import {
  LEARNING_LEVELS,
  LEARNING_REQUEST_STATUSES,
  PreferredAvailabilityDto,
} from "./learning-requests.dto";

const NULLABLE_LEVEL = {
  type: String,
  enum: LEARNING_LEVELS,
  nullable: true,
} as const;

export class PreferredSlotResponse {
  @ApiProperty({ format: "date-time" })
  startAt!: Date;

  @ApiProperty({ format: "date-time" })
  endAt!: Date;
}

export class LearningRequestPublicOwnerResponse {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty()
  displayName!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description:
      "Signed avatar URL valid for 60 seconds; null without a CLEAN selected avatar.",
  })
  avatarUrl!: string | null;
}

export class OfferedSharingSkillResponse {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty({
    type: "object",
    required: ["id", "name"],
    properties: {
      id: { type: "string", format: "uuid" },
      name: { type: "string" },
    },
  })
  skill!: { id: string; name: string };

  @ApiProperty({ description: "Sharing Skill catalog level code." })
  level!: string;
  @ApiProperty({ type: String, format: "uuid", nullable: true }) levelId!:
    string | null;
  @ApiProperty({ type: SkillLevelResponse, nullable: true })
  skillLevel!: SkillLevelResponse | null;

  @ApiProperty({ enum: ["UNVERIFIED", "PENDING", "VERIFIED", "REJECTED"] })
  verificationStatus!: string;
}

class LearningRequestCardResponse {
  @ApiProperty()
  description!: string;

  @ApiProperty({ type: [PreferredSlotResponse] })
  preferredSlots!: PreferredSlotResponse[];

  @ApiProperty({ type: String, nullable: true, maxLength: 3000 })
  teachingOverview!: string | null;

  @ApiProperty({ type: PreferredAvailabilityDto, nullable: true })
  preferredAvailability!: PreferredAvailabilityDto | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: "50.00",
    description:
      "Desired Credit per hour. An indicative budget, not a wallet Hold.",
  })
  desiredCreditPerHour!: string | null;

  @ApiProperty({
    type: [OfferedSharingSkillResponse],
    description:
      "Currently public, eligible Sharing Skills selected by the request owner.",
  })
  offeredSharingSkills!: OfferedSharingSkillResponse[];
}

class LearningRequestContentResponse extends LearningRequestCardResponse {
  @ApiProperty({
    type: [String],
    description:
      "Pending tag labels visible to the owner and reviewers. Empty after approval; approved IDs are in tagIds.",
  })
  proposedTags!: string[];

  @ApiProperty({ type: [String], format: "uuid" })
  offeredSharingSkillIds!: string[];
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty({ format: "uuid" })
  skillId!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  learningGoal!: string;

  @ApiProperty(NULLABLE_LEVEL)
  currentLevel!: string | null;

  @ApiProperty({ default: false })
  verifiedTeacherOnly!: boolean;

  @ApiProperty({ type: [String], format: "uuid" })
  tagIds!: string[];

  @ApiProperty({ enum: LEARNING_REQUEST_STATUSES })
  status!: string;
}

export class LearningRequestOwnerResponse extends LearningRequestContentResponse {
  @ApiPropertyOptional({ enum: LEARNING_REQUEST_STATUSES })
  effectiveStatus?: string;

  @ApiProperty({ enum: ["NOT_REQUIRED", "PENDING", "APPROVED", "REJECTED"] })
  moderationStatus!: string;

  @ApiProperty({ type: String, nullable: true })
  moderationRejectReason!: string | null;

  @ApiProperty({ type: "integer", minimum: 1 })
  version!: number;

  @ApiProperty({ type: String, format: "date-time", nullable: true })
  requestedExpiresAt!: Date | null;

  @ApiProperty({ type: String, format: "date-time", nullable: true })
  expiresAt!: Date | null;

  @ApiProperty({ type: String, format: "date-time", nullable: true })
  publishedAt!: Date | null;

  @ApiProperty({ format: "date-time" })
  createdAt!: Date;

  @ApiProperty({ format: "date-time" })
  updatedAt!: Date;
}

export class LearningRequestSummaryResponse extends LearningRequestCardResponse {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty({
    type: "object",
    required: ["id", "name"],
    properties: {
      id: { type: "string", format: "uuid" },
      name: { type: "string" },
    },
  })
  skill!: { id: string; name: string };

  @ApiProperty({
    type: "array",
    items: {
      type: "object",
      required: ["id", "label"],
      properties: {
        id: { type: "string", format: "uuid" },
        label: { type: "string" },
      },
    },
  })
  tags!: { id: string; label: string }[];

  @ApiProperty()
  learningGoal!: string;

  @ApiProperty(NULLABLE_LEVEL)
  currentLevel!: string | null;

  @ApiProperty({ default: false })
  verifiedTeacherOnly!: boolean;

  @ApiProperty({ enum: ["OPEN"] })
  status!: string;

  @ApiProperty({ type: LearningRequestPublicOwnerResponse })
  owner!: LearningRequestPublicOwnerResponse;

  @ApiProperty({ format: "date-time" })
  createdAt!: Date;

  @ApiProperty({ type: String, format: "date-time", nullable: true })
  expiresAt!: Date | null;
}

export class LearningRequestDetailResponse extends LearningRequestSummaryResponse {
  @ApiProperty({ type: "integer", minimum: 1 })
  version!: number;
}

export class LearningRequestRecommendationResponse extends LearningRequestSummaryResponse {
  @ApiProperty({ type: "integer", minimum: 0 })
  matchScore!: number;
}

export class LearningRequestModerationResponse extends LearningRequestContentResponse {
  @ApiProperty({ format: "uuid" })
  ownerId!: string;

  @ApiProperty({ enum: ["NOT_REQUIRED", "PENDING", "APPROVED", "REJECTED"] })
  moderationStatus!: string;

  @ApiProperty({ type: String, nullable: true })
  moderationRejectReason!: string | null;

  @ApiProperty({ type: [String] })
  flaggedCategories!: string[];

  @ApiProperty({ type: "integer", minimum: 1, nullable: true })
  moderationReviewedVersion!: number | null;

  @ApiProperty({ type: String, nullable: true, format: "uuid" })
  moderatedByUserId!: string | null;

  @ApiProperty({ type: String, nullable: true, format: "date-time" })
  moderatedAt!: Date | null;

  @ApiProperty({ type: String, nullable: true, format: "date-time" })
  expiresAt!: Date | null;

  @ApiProperty({ type: "integer", minimum: 1 })
  version!: number;

  @ApiProperty({ format: "date-time" })
  createdAt!: Date;

  @ApiProperty({ format: "date-time" })
  updatedAt!: Date;
}
