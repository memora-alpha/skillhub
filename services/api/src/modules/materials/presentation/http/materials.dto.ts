import { ListPageQuery } from "../../../../shared/http/list-page";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from "class-validator";
import { REPORT_REASON_CODES } from "../../../reports/presentation/http/reports.dto";
import {
  MATERIAL_STATES,
  type MaterialState,
} from "../../domain/material.policy";

const ACCESS = ["FREE", "PAID"] as const;
/** Staff review queue; DRAFTs stay private to their owner. */
const STAFF_STATES = [
  "PENDING_REVIEW",
  "PUBLISHED",
  "REJECTED",
  "HIDDEN",
  "ARCHIVED",
] as const;

export class CreateMaterialDto {
  @IsUUID("4") skillId!: string;
  @IsString() @MinLength(5) @MaxLength(150) title!: string;
  @IsString() @MinLength(10) @MaxLength(3000) description!: string;
  @IsIn(ACCESS) accessType!: (typeof ACCESS)[number];
  /** Decimal Credit text, for example "0" or "25.50". */
  @IsString() @MaxLength(13) priceCredit!: string;
  /** BR-42: must be true; the service answers MATERIAL_RIGHTS_CONFIRMATION_REQUIRED otherwise. */
  @IsBoolean() distributionRightsConfirmed!: boolean;
  @IsOptional() @IsUUID("4") fileId?: string;
  @IsOptional() @IsUUID("4") coverFileId?: string;
}

export class UpdateMaterialDto {
  @IsInt() @Min(1) expectedListingVersion!: number;
  @IsOptional() @IsUUID("4") skillId?: string;
  @IsOptional() @IsString() @MinLength(5) @MaxLength(150) title?: string;
  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(3000)
  description?: string;
  @IsOptional() @IsIn(ACCESS) accessType?: (typeof ACCESS)[number];
  @IsOptional() @IsString() @MaxLength(13) priceCredit?: string;
  @IsOptional() @IsUUID("4") fileId?: string | null;
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsUUID("4")
  coverFileId?: string | null;
  @IsOptional() @IsBoolean() distributionRightsConfirmed?: boolean;
}

export class DeleteMaterialQueryDto {
  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedListingVersion!: number;
}

export class MaterialVersionDto {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  expectedListingVersion!: number;
}

export class WithdrawMaterialDto extends MaterialVersionDto {}

export class OwnerMaterialListQueryDto extends ListPageQuery {
  @ApiPropertyOptional({
    enum: MATERIAL_STATES,
    description:
      "Filter by status. Omit to list materials other than ARCHIVED.",
  })
  @IsOptional()
  @IsIn(MATERIAL_STATES)
  status?: MaterialState;
}

export class MaterialQueryDto {
  @IsOptional() @IsString() @MaxLength(100) q?: string;
  @IsOptional() @IsUUID("4") skillId?: string;
  @IsOptional() @IsIn(ACCESS) accessType?: (typeof ACCESS)[number];
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10_000) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit = 20;
}

export class StaffMaterialQueryDto extends ListPageQuery {
  @IsOptional() @IsIn(STAFF_STATES) status?: (typeof STAFF_STATES)[number];
}

export class PurchaseMaterialDto {
  @IsInt() @Min(1) expectedListingVersion!: number;
}

export class ModerateMaterialDto {
  @IsInt() @Min(1) expectedListingVersion!: number;
  @IsOptional() @IsString() @MaxLength(2000) reason?: string;
}

export class ReportMaterialDto {
  @IsIn(REPORT_REASON_CODES) reasonCode!: (typeof REPORT_REASON_CODES)[number];
  @IsString() @MinLength(10) @MaxLength(2000) description!: string;
}

export class MaterialReviewQueryDto extends ListPageQuery {
  @Max(50)
  override limit = 20;
}

export class CreateMaterialReviewDto {
  @IsInt() @Min(1) @Max(5) rating!: number;
  @IsOptional() @IsString() @MaxLength(2000) comment?: string;
}

export class UpdateMaterialReviewDto {
  @IsInt() @Min(1) expectedVersion!: number;
  @IsOptional() @IsInt() @Min(1) @Max(5) rating?: number;
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(2000)
  comment?: string | null;
}

export class DeleteMaterialReviewQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}

export class ReportMaterialReviewDto {
  @IsIn(REPORT_REASON_CODES) reasonCode!: (typeof REPORT_REASON_CODES)[number];
  @IsString() @MinLength(10) @MaxLength(2000) description!: string;
}

export class StaffMaterialReviewQueryDto extends ListPageQuery {
  @IsOptional()
  @IsIn(["REPORTED", "HIDDEN"])
  status?: "REPORTED" | "HIDDEN";
}

export class ModerateMaterialReviewDto {
  @IsInt() @Min(1) expectedVersion!: number;
  @IsString() @MinLength(1) @MaxLength(2000) reason!: string;
}
