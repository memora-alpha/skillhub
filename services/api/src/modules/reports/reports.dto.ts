import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import { ADJUDICATED_RESTRICTION_DAYS } from "../reputation/reputation.service";

/** SRS 1.6 §18.23 report reason codes. */
export const REPORT_REASON_CODES = [
  "NO_SHOW_LATE",
  "INAPPROPRIATE_BEHAVIOR",
  "HARASSMENT",
  "SKILL_MISMATCH",
  "FALSE_INFORMATION",
  "TECHNICAL_ISSUE",
  "CREDIT_ISSUE",
  "INAPPROPRIATE_CONTENT",
  "SPAM_SCAM",
  "OTHER",
] as const;

export class CreateSessionReportDto {
  @IsIn(REPORT_REASON_CODES)
  reasonCode!: (typeof REPORT_REASON_CODES)[number];

  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  description!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsUUID("4", { each: true })
  evidenceFileIds: string[] = [];
}

/** SRS 1.6 §18.34 adjudicated violations; FRAUD carries a -20..-30 delta. */
export class ReportViolationDto {
  @IsUUID("4")
  userId!: string;

  @IsIn([
    "LATE_CANCELLATION",
    "NO_SHOW",
    "LIGHT_VIOLATION",
    "MEDIUM_HARASSMENT",
    "FRAUD",
  ])
  reasonCode!:
    | "LATE_CANCELLATION"
    | "NO_SHOW"
    | "LIGHT_VIOLATION"
    | "MEDIUM_HARASSMENT"
    | "FRAUD";

  @IsOptional()
  @IsInt()
  @Min(-30)
  @Max(-20)
  delta?: number;
}

export class ReportRestrictionDto {
  @IsUUID("4")
  userId!: string;

  @IsIn(ADJUDICATED_RESTRICTION_DAYS)
  days!: (typeof ADJUDICATED_RESTRICTION_DAYS)[number];
}

export class ReportCreditAdjustmentDto {
  @IsUUID("4")
  userId!: string;

  /** Signed Credit with up to two decimals, e.g. "-5.00". */
  @Matches(/^-?(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/)
  amount!: string;
}

export class ReportReversalDto {
  @IsUUID("4")
  operationId!: string;
}

export class ReportCaseActionDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(2)
  @ValidateNested({ each: true })
  @Type(() => ReportViolationDto)
  violations?: ReportViolationDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => ReportRestrictionDto)
  restriction?: ReportRestrictionDto;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(2)
  @ValidateNested({ each: true })
  @Type(() => ReportCreditAdjustmentDto)
  creditAdjustments?: ReportCreditAdjustmentDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => ReportReversalDto)
  reversals?: ReportReversalDto[];
}
