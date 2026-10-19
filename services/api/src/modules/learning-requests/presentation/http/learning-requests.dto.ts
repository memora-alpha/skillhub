import { Transform, Type } from "class-transformer";
import { applyDecorators } from "@nestjs/common";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
  MaxLength,
  ValidateIf,
  ValidateNested,
  Matches,
  IsTimeZone,
} from "class-validator";
import {
  LOCAL_TIME_PATTERN,
  IANA_ZONE_PATTERN,
  WEEKDAYS,
} from "../../domain/request-preferences.policy";

export const LEARNING_LEVELS = [
  "NONE",
  "BEGINNER",
  "INTERMEDIATE",
  "ADVANCED",
] as const;

export const LEARNING_REQUEST_STATUSES = [
  "DRAFT",
  "PENDING_MODERATION",
  "OPEN",
  "REJECTED",
  "NEGOTIATING",
  "MATCHED",
  "CLOSED",
  "CANCELLED",
  "EXPIRED",
] as const;

function toStringArray(value: unknown): unknown {
  if (value === undefined) return undefined;
  return Array.isArray(value) ? value : [value];
}

export class LearningRequestQueryDto {
  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  skillId?: string;

  @ApiPropertyOptional({
    type: [String],
    format: "uuid",
    maxItems: 10,
    uniqueItems: true,
  })
  @IsOptional()
  @Transform(({ value }) => toStringArray(value))
  @IsArray()
  @ArrayMaxSize(10)
  @ArrayUnique()
  @IsUUID("all", { each: true })
  tagIds?: string[];

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiPropertyOptional({
    enum: LEARNING_REQUEST_STATUSES,
    description:
      "Mine accepts all statuses; feed/recommended accept only OPEN; the moderation queue accepts only PENDING_MODERATION.",
  })
  @IsOptional()
  @IsEnum(LEARNING_REQUEST_STATUSES)
  status?: (typeof LEARNING_REQUEST_STATUSES)[number];

  @ApiPropertyOptional({
    type: "integer",
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ maxLength: 1024 })
  @IsOptional()
  @IsString()
  @MaxLength(1024)
  cursor?: string;
}

export class PreferredSlotDto {
  @ApiProperty({
    format: "date-time",
    description:
      "ISO 8601 timestamp with timezone offset; must be in the future.",
  })
  @IsString()
  @IsDateString({ strict: true })
  startAt!: string;

  @ApiProperty({
    format: "date-time",
    description:
      "ISO 8601 timestamp with timezone offset; must be after startAt.",
  })
  @IsString()
  @IsDateString({ strict: true })
  endAt!: string;
}

export class WeeklySlotDto {
  @ApiProperty({ enum: WEEKDAYS, example: "MON" })
  @IsEnum(WEEKDAYS)
  weekday!: (typeof WEEKDAYS)[number];

  @ApiProperty({ pattern: LOCAL_TIME_PATTERN.source, example: "19:00" })
  @Matches(LOCAL_TIME_PATTERN)
  startTime!: string;

  @ApiProperty({ pattern: LOCAL_TIME_PATTERN.source, example: "21:00" })
  @Matches(LOCAL_TIME_PATTERN)
  endTime!: string;
}

export class PreferredAvailabilityDto {
  @ApiProperty({
    example: "Asia/Ho_Chi_Minh",
    description: "IANA timezone for local weekly wall-clock times.",
  })
  @IsTimeZone()
  @Matches(IANA_ZONE_PATTERN)
  timeZone!: string;

  @ApiProperty({
    type: [WeeklySlotDto],
    maxItems: 5,
    description:
      "Same-day ranges; end must exceed start; no overlap on the same weekday.",
  })
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => WeeklySlotDto)
  weeklySlots!: WeeklySlotDto[];
}

class LearningRequestOfferingDto {
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    minLength: 20,
    maxLength: 3000,
    description:
      "What the request owner can teach in exchange; sanitized and moderated.",
  })
  @IsOptional()
  @IsString()
  teachingOverview?: string | null;

  @ApiPropertyOptional({
    type: [String],
    format: "uuid",
    maxItems: 10,
    uniqueItems: true,
    description:
      "Owner's active, visible Sharing Skill IDs selected from GET /me/skills. [] clears selections.",
  })
  @ValidateIf((_object, value) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(10)
  @ArrayUnique()
  @IsUUID("all", { each: true })
  @Transform(({ value }) =>
    Array.isArray(value)
      ? value.map((id: unknown) =>
          typeof id === "string" ? id.toLowerCase() : id,
        )
      : value,
  )
  offeredSharingSkillIds?: string[];

  @ApiPropertyOptional({
    type: PreferredAvailabilityDto,
    nullable: true,
    description:
      "Weekly availability. Replaces absolute preferredSlots; null clears.",
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => PreferredAvailabilityDto)
  preferredAvailability?: PreferredAvailabilityDto | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: "50.00",
    description:
      "Desired Credit per hour, greater than zero with up to two decimals. An indicative budget; null clears.",
  })
  @IsOptional()
  @IsString()
  @Matches(/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/)
  desiredCreditPerHour?: string | null;
}

function OptionalPreferredSlots(defaultValue?: []) {
  return applyDecorators(
    ApiPropertyOptional({
      type: [PreferredSlotDto],
      maxItems: 5,
      default: defaultValue,
    }),
    ValidateIf((_object, value) => value !== undefined),
    IsArray(),
    ArrayMaxSize(5),
    ValidateNested({ each: true }),
    Type(() => PreferredSlotDto),
  );
}

function OptionalExpiry(description: string) {
  return applyDecorators(
    ApiPropertyOptional({
      type: String,
      format: "date-time",
      nullable: true,
      description,
    }),
    ValidateIf((_object, value) => value !== undefined && value !== null),
    IsString(),
    IsDateString({ strict: true }),
  );
}

export class CreateLearningRequestDto extends LearningRequestOfferingDto {
  @ApiProperty({
    minLength: 10,
    maxLength: 120,
    example: "Học giao tiếp tiếng Anh",
  })
  @IsString()
  title!: string;

  @ApiProperty({
    format: "uuid",
    description: "ID of an ACTIVE catalog skill.",
  })
  @IsUUID()
  skillId!: string;

  @ApiProperty({
    minLength: 20,
    maxLength: 3000,
    example: "Mình muốn luyện giao tiếp tiếng Anh với người có kinh nghiệm.",
  })
  @IsString()
  description!: string;

  @ApiProperty({
    minLength: 10,
    maxLength: 1000,
    example: "Tự tin giao tiếp trong các tình huống hằng ngày.",
  })
  @IsString()
  learningGoal!: string;

  @ApiPropertyOptional({ type: String, enum: LEARNING_LEVELS, nullable: true })
  @IsOptional()
  @IsEnum(LEARNING_LEVELS)
  currentLevel?: (typeof LEARNING_LEVELS)[number] | null;

  @ApiPropertyOptional({
    type: Boolean,
    default: false,
    description:
      "Require the teacher's Sharing Skill for this skill to be VERIFIED.",
  })
  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  verifiedTeacherOnly?: boolean;

  @ApiPropertyOptional({
    type: [String],
    format: "uuid",
    maxItems: 10,
    uniqueItems: true,
    default: [],
  })
  @ValidateIf((_object, value) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(10)
  @ArrayUnique()
  @IsUUID("all", { each: true })
  tagIds?: string[];

  @OptionalPreferredSlots([])
  preferredSlots?: PreferredSlotDto[];

  @OptionalExpiry(
    "Future expiry with timezone offset, at most 90 days after publishing. Omit or use null for 30 days after publishing.",
  )
  expiresAt?: string | null;
}

class VersionedLearningRequestDto {
  @ApiProperty({
    type: "integer",
    minimum: 1,
    maximum: Number.MAX_SAFE_INTEGER,
  })
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  expectedVersion!: number;
}

export class PublishLearningRequestDto extends VersionedLearningRequestDto {}

export class CancelLearningRequestDto extends VersionedLearningRequestDto {}

export class EditLearningRequestDto extends LearningRequestOfferingDto {
  @ApiProperty({
    type: "integer",
    minimum: 1,
    maximum: Number.MAX_SAFE_INTEGER,
  })
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  expectedVersion!: number;
  @ApiPropertyOptional({ minLength: 10, maxLength: 120 })
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title?: string;

  @ApiPropertyOptional({ format: "uuid" })
  @ValidateIf((_object, value) => value !== undefined)
  @IsUUID()
  skillId?: string;

  @ApiPropertyOptional({ minLength: 20, maxLength: 3000 })
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(3000)
  description?: string;

  @ApiPropertyOptional({ minLength: 10, maxLength: 1000 })
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  learningGoal?: string;

  @ApiPropertyOptional({ type: String, enum: LEARNING_LEVELS, nullable: true })
  @IsOptional()
  @IsEnum(LEARNING_LEVELS)
  currentLevel?: (typeof LEARNING_LEVELS)[number] | null;

  @ApiPropertyOptional({
    type: Boolean,
    description:
      "Require a VERIFIED Sharing Skill; omission keeps the current preference.",
  })
  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  verifiedTeacherOnly?: boolean;

  @ApiPropertyOptional({
    type: [String],
    format: "uuid",
    maxItems: 10,
    uniqueItems: true,
  })
  @ValidateIf((_object, value) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(10)
  @ArrayUnique()
  @IsUUID("all", { each: true })
  tagIds?: string[];

  @OptionalPreferredSlots()
  preferredSlots?: PreferredSlotDto[];

  @OptionalExpiry(
    "Omit to keep the current expiry preference; use null for the default expiry.",
  )
  expiresAt?: string | null;
}
