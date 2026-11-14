import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class AdminWindowQueryDto {
  @ApiProperty({ format: "date-time" })
  @IsISO8601({ strict: true })
  from!: string;

  @ApiProperty({ format: "date-time" })
  @IsISO8601({ strict: true })
  to!: string;

  @ApiPropertyOptional({ default: "Asia/Ho_Chi_Minh" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  timezone?: string;
}

export class AdminTrendQueryDto extends AdminWindowQueryDto {
  @ApiPropertyOptional({ enum: ["day"], default: "day" })
  @IsOptional()
  @IsIn(["day"])
  granularity = "day" as const;
}

export const WORK_ITEM_KINDS = [
  "PAYMENT_REVIEW",
  "SETTLEMENT_REVIEW",
  "REPORT_CASE",
  "REPORT_INCIDENT",
  "PATH_TERMINATION",
  "SKILL_VERIFICATION",
  "TAG_REQUEST",
] as const;

export class AdminWorkItemQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  cursor?: string;

  @IsOptional()
  @IsIn(WORK_ITEM_KINDS)
  kind?: (typeof WORK_ITEM_KINDS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(32)
  severity?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  waitingOn?: string;

  @IsOptional()
  @IsUUID()
  assignee?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100_000)
  minAgeHours?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @IsOptional()
  @IsIn(["oldest", "newest"])
  sort: "oldest" | "newest" = "oldest";
}

export class AdminLearningPathQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  cursor?: string;

  @IsOptional()
  @IsIn([
    "DRAFT",
    "PROPOSED",
    "PARTIALLY_CONFIRMED",
    "CONFIRMED",
    "SCHEDULED",
    "ACTIVE",
    "COMPLETED",
    "CANCELLED",
    "DISPUTED",
  ])
  status?: string;

  @IsOptional()
  @IsUUID()
  participantId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;
}
