import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from "class-validator";
import { ListPageQuery } from "../../../../shared/http/list-page";

const PLAN_CODES = ["CREATOR", "PRO"] as const;
const INTERVALS = ["MONTH", "YEAR"] as const;
type PlanCode = (typeof PLAN_CODES)[number];
type Interval = (typeof INTERVALS)[number];

export class PurchaseSubscriptionDto {
  @ApiProperty({ enum: PLAN_CODES }) @IsIn(PLAN_CODES) planCode!: PlanCode;
  @ApiProperty({ enum: INTERVALS }) @IsIn(INTERVALS) interval!: Interval;
  @ApiProperty() @IsUUID("4") expectedPlanVersionId!: string;
}

/** Spec 021 D14: packs of `subscription.recordingAddon.minutes` at the confirmed price. */
export class BuyRecordingMinutesDto {
  @ApiProperty({ minimum: 1, maximum: 10 })
  @IsInt()
  @Min(1)
  @Max(10)
  packs!: number;
  /** Whole Credit per pack, as shown to the user. */
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  expectedPriceCredit!: number;
}

export class UpgradeQuoteQueryDto {
  @ApiProperty({ enum: PLAN_CODES }) @IsIn(PLAN_CODES) planCode!: PlanCode;
}

export class UpgradeSubscriptionDto {
  @ApiProperty({ enum: PLAN_CODES }) @IsIn(PLAN_CODES) planCode!: PlanCode;
  @ApiProperty() @IsUUID("4") expectedPlanVersionId!: string;
  /** Decimal Credit text from the quote, for example "133.33". */
  @ApiProperty() @IsString() @MaxLength(13) expectedAmount!: string;
  @ApiProperty() @Type(() => Number) @IsInt() @Min(1) expectedVersion!: number;
}

/** PATCH: an omitted field keeps its value; `null` clears a scheduled change. */
export class UpdateSubscriptionDto {
  @ApiProperty() @IsInt() @Min(1) expectedVersion!: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() autoRenew?: boolean;
  @ApiPropertyOptional({ enum: PLAN_CODES, nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsIn(PLAN_CODES)
  scheduledPlanCode?: PlanCode | null;
  @ApiPropertyOptional({ enum: INTERVALS, nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsIn(INTERVALS)
  scheduledInterval?: Interval | null;
}

class ReasonBody {
  @ApiProperty() @IsString() @Length(1, 500) reason!: string;
}

export class CreatePlanVersionDto extends ReasonBody {
  @ApiProperty({ enum: PLAN_CODES }) @IsIn(PLAN_CODES) planCode!: PlanCode;
  /** Decimal Credit text, for example "99" or "99.00". */
  @ApiProperty() @IsString() @MaxLength(13) monthPrice!: string;
  @ApiProperty() @IsString() @MaxLength(13) yearPrice!: string;
  @ApiProperty({ type: Object }) @IsObject() entitlements!: Record<
    string,
    unknown
  >;
}

export class ApprovePlanVersionDto extends ReasonBody {
  @ApiProperty() @IsISO8601({ strict: true }) effectiveAt!: string;
}

export class RetirePlanVersionDto extends ReasonBody {}

export class AdminPlanQueryDto extends ListPageQuery {
  @ApiPropertyOptional({ enum: PLAN_CODES })
  @IsOptional()
  @IsIn(PLAN_CODES)
  planCode?: PlanCode;
  @ApiPropertyOptional({ enum: ["DRAFT", "APPROVED", "RETIRED"] })
  @IsOptional()
  @IsIn(["DRAFT", "APPROVED", "RETIRED"])
  status?: "DRAFT" | "APPROVED" | "RETIRED";
}

export class AdminSubscriptionQueryDto extends ListPageQuery {
  @ApiPropertyOptional({ enum: ["ACTIVE", "GRACE", "EXPIRED"] })
  @IsOptional()
  @IsIn(["ACTIVE", "GRACE", "EXPIRED"])
  status?: "ACTIVE" | "GRACE" | "EXPIRED";
  @ApiPropertyOptional({ enum: PLAN_CODES })
  @IsOptional()
  @IsIn(PLAN_CODES)
  planCode?: PlanCode;
  @ApiPropertyOptional() @IsOptional() @IsUUID("4") userId?: string;
}
