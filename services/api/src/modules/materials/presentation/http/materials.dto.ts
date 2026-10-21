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
} from "class-validator";
import { REPORT_REASON_CODES } from "../../../reports/presentation/http/reports.dto";

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
  @IsOptional() @IsUUID("4") fileId?: string;
  @IsOptional() @IsBoolean() distributionRightsConfirmed?: boolean;
}

export class MaterialQueryDto {
  @IsOptional() @IsString() @MaxLength(100) q?: string;
  @IsOptional() @IsUUID("4") skillId?: string;
  @IsOptional() @IsIn(ACCESS) accessType?: (typeof ACCESS)[number];
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10_000) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit = 20;
}

export class StaffMaterialQueryDto {
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
