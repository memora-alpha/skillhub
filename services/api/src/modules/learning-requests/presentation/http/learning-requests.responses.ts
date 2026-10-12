import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class PreferredSlotResponse {
  @ApiProperty({ format: "date-time" })
  startAt!: Date;

  @ApiProperty({ format: "date-time" })
  endAt!: Date;
}

export class LearningRequestOwnerResponse {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty({ format: "uuid" })
  skillId!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  description!: string;

  @ApiProperty()
  learningGoal!: string;

  @ApiProperty({
    type: String,
    enum: ["NONE", "BEGINNER", "INTERMEDIATE", "ADVANCED"],
    nullable: true,
  })
  currentLevel!: string | null;

  @ApiProperty({ default: false })
  verifiedTeacherOnly!: boolean;

  @ApiProperty({ type: [String], format: "uuid" })
  tagIds!: string[];

  @ApiProperty({ type: [PreferredSlotResponse] })
  preferredSlots!: PreferredSlotResponse[];

  @ApiProperty({
    enum: [
      "DRAFT",
      "PENDING_MODERATION",
      "OPEN",
      "REJECTED",
      "NEGOTIATING",
      "MATCHED",
      "CLOSED",
      "CANCELLED",
      "EXPIRED",
    ],
  })
  status!: string;

  @ApiPropertyOptional({
    enum: [
      "DRAFT",
      "PENDING_MODERATION",
      "OPEN",
      "REJECTED",
      "NEGOTIATING",
      "MATCHED",
      "CLOSED",
      "CANCELLED",
      "EXPIRED",
    ],
  })
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

export class LearningRequestSummaryResponse {
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

  @ApiProperty({
    type: String,
    enum: ["NONE", "BEGINNER", "INTERMEDIATE", "ADVANCED"],
    nullable: true,
  })
  currentLevel!: string | null;

  @ApiProperty({ default: false })
  verifiedTeacherOnly!: boolean;

  @ApiProperty({ enum: ["OPEN"] })
  status!: string;

  @ApiProperty({
    type: "object",
    required: ["id", "displayName"],
    properties: {
      id: { type: "string", format: "uuid" },
      displayName: { type: "string" },
    },
  })
  owner!: { id: string; displayName: string };

  @ApiProperty({ format: "date-time" })
  createdAt!: Date;

  @ApiProperty({ type: String, format: "date-time", nullable: true })
  expiresAt!: Date | null;
}

export class LearningRequestDetailResponse extends LearningRequestSummaryResponse {
  @ApiProperty()
  description!: string;

  @ApiProperty({ type: [PreferredSlotResponse] })
  preferredSlots!: PreferredSlotResponse[];

  @ApiProperty({ type: "integer", minimum: 1 })
  version!: number;
}

export class LearningRequestRecommendationResponse extends LearningRequestSummaryResponse {
  @ApiProperty({ type: "integer", minimum: 0 })
  matchScore!: number;
}

export class LearningRequestModerationResponse {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty({ format: "uuid" })
  ownerId!: string;

  @ApiProperty({ format: "uuid" })
  skillId!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  description!: string;

  @ApiProperty()
  learningGoal!: string;

  @ApiProperty({
    type: String,
    enum: ["NONE", "BEGINNER", "INTERMEDIATE", "ADVANCED"],
    nullable: true,
  })
  currentLevel!: string | null;

  @ApiProperty({ default: false })
  verifiedTeacherOnly!: boolean;

  @ApiProperty({ type: [String], format: "uuid" })
  tagIds!: string[];

  @ApiProperty({ type: [PreferredSlotResponse] })
  preferredSlots!: PreferredSlotResponse[];

  @ApiProperty({
    enum: [
      "DRAFT",
      "PENDING_MODERATION",
      "OPEN",
      "REJECTED",
      "NEGOTIATING",
      "MATCHED",
      "CLOSED",
      "CANCELLED",
      "EXPIRED",
    ],
  })
  status!: string;

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
