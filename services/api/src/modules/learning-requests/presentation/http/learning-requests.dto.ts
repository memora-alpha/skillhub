import { Transform, Type } from "class-transformer";
import { ApiPropertyOptional } from "@nestjs/swagger";
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
  @IsOptional()
  @IsUUID()
  skillId?: string;

  @IsOptional()
  @Transform(({ value }) => toStringArray(value))
  @IsArray()
  @ArrayMaxSize(10)
  @ArrayUnique()
  @IsUUID("all", { each: true })
  tagIds?: string[];

  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsEnum(LEARNING_REQUEST_STATUSES)
  status?: (typeof LEARNING_REQUEST_STATUSES)[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1024)
  cursor?: string;
}

export class PreferredSlotDto {
  @IsString()
  @IsDateString({ strict: true })
  startAt!: string;

  @IsString()
  @IsDateString({ strict: true })
  endAt!: string;
}

export class CreateLearningRequestDto {
  @IsString()
  title!: string;

  @IsUUID()
  skillId!: string;

  @IsString()
  description!: string;

  @IsString()
  learningGoal!: string;

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

  @ValidateIf((_object, value) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(10)
  @ArrayUnique()
  @IsUUID("all", { each: true })
  tagIds?: string[];

  @ValidateIf((_object, value) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => PreferredSlotDto)
  preferredSlots?: PreferredSlotDto[];

  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsString()
  @IsDateString({ strict: true })
  expiresAt?: string | null;
}

export class PublishLearningRequestDto {
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  expectedVersion!: number;
}

export class CancelLearningRequestDto {
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  expectedVersion!: number;
}

export class EditLearningRequestDto {
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  expectedVersion!: number;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsUUID()
  skillId?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(3000)
  description?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  learningGoal?: string;

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

  @ValidateIf((_object, value) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(10)
  @ArrayUnique()
  @IsUUID("all", { each: true })
  tagIds?: string[];

  @ValidateIf((_object, value) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => PreferredSlotDto)
  preferredSlots?: PreferredSlotDto[];

  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsString()
  @IsDateString({ strict: true })
  expiresAt?: string | null;
}
