import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from "class-validator";
import { ListPageQuery } from "../../../../shared/http/list-page";

export class ProductQueryDto {
  @ApiPropertyOptional({ enum: ["vi", "en"], default: "vi" })
  @IsOptional()
  @IsIn(["vi", "en"])
  locale?: "vi" | "en";
  @ApiPropertyOptional() @IsOptional() @IsUUID("4") brandId?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;
}

export class LocaleQueryDto {
  @ApiPropertyOptional({ enum: ["vi", "en"], default: "vi" })
  @IsOptional()
  @IsIn(["vi", "en"])
  locale?: "vi" | "en";
}

export class RedeemDto {
  @ApiProperty() @IsUUID("4") productId!: string;
  @ApiProperty() @IsInt() @Min(1) expectedPriceVersion!: number;
}

export class AdminRedemptionQueryDto extends ListPageQuery {
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID("4") userId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID("4") productId?: string;
}

export class AdminProductQueryDto extends ListPageQuery {
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;
}

export class UpdateProductDto {
  /** Decimal Credit text, for example "50" or "25.50"; null clears the price. */
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(13)
  priceCredit?: string | null;
  @ApiPropertyOptional({ enum: ["ACTIVE", "INACTIVE"] })
  @IsOptional()
  @IsIn(["ACTIVE", "INACTIVE"])
  status?: "ACTIVE" | "INACTIVE";
  @ApiPropertyOptional() @IsOptional() @IsInt() sortOrder?: number;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(200)
  displayNameOverride?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(2048)
  imageOverride?: string | null;
  @ApiProperty() @IsString() @MaxLength(500) reason!: string;
}

export class ManualVoucherDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  code?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) pin?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  link?: string;
  @ApiPropertyOptional() @IsOptional() @IsISO8601() expiresAt?: string;
}

export class ResolveRedemptionDto {
  @ApiProperty({ enum: ["ISSUED", "REFUND"] })
  @IsIn(["ISSUED", "REFUND"])
  action!: "ISSUED" | "REFUND";
  @ApiProperty() @IsString() @MaxLength(500) reason!: string;
  @ApiPropertyOptional({ type: ManualVoucherDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => ManualVoucherDto)
  voucher?: ManualVoucherDto;
}
