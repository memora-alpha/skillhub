import { Transform, Type } from "class-transformer";
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
} from "class-validator";

const LEARNING_LEVELS = [
  "NONE",
  "BEGINNER",
  "INTERMEDIATE",
  "ADVANCED",
] as const;

const LEARNING_REQUEST_STATUSES = [
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

export class CreateLearningRequestDto {
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

  @ApiPropertyOptional({ type: [PreferredSlotDto], maxItems: 5, default: [] })
  @ValidateIf((_object, value) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => PreferredSlotDto)
  preferredSlots?: PreferredSlotDto[];

  @ApiPropertyOptional({
    type: String,
    format: "date-time",
    nullable: true,
    description:
      "Future expiry with timezone offset, at most 90 days after publishing. Omit or use null for 30 days after publishing.",
  })
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsString()
  @IsDateString({ strict: true })
  expiresAt?: string | null;
}

export class PublishLearningRequestDto {
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

export class CancelLearningRequestDto {
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

export class EditLearningRequestDto {
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

  @ApiPropertyOptional({ type: [PreferredSlotDto], maxItems: 5 })
  @ValidateIf((_object, value) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => PreferredSlotDto)
  preferredSlots?: PreferredSlotDto[];

  @ApiPropertyOptional({
    type: String,
    format: "date-time",
    nullable: true,
    description:
      "Omit to keep the current expiry preference; use null for the default expiry.",
  })
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsString()
  @IsDateString({ strict: true })
  expiresAt?: string | null;
}
