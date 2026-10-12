import {
  ApiProperty,
  ApiPropertyOptional,
  PartialType,
  OmitType,
} from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  IsString,
  Length,
  IsOptional,
  IsUUID,
  IsIn,
  IsInt,
  Min,
  Max,
  Matches,
  ValidateIf,
} from "class-validator";
const trim = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim().normalize("NFC") : value;
export class TagQueryDto {
  @ApiPropertyOptional({
    type: String,
    minLength: 0,
    maxLength: 120,
    description:
      "Case-insensitive literal label search; empty returns all ACTIVE tags.",
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(0, 120)
  q?: string;
  @ApiPropertyOptional({
    type: "integer",
    minimum: 1,
    maximum: 100,
    default: 20,
    description: "Maximum tags per page.",
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
  @ApiPropertyOptional({
    type: String,
    minLength: 1,
    maxLength: 1024,
    description:
      "Opaque nextCursor from the same search; ordered by label then id.",
  })
  @IsOptional()
  @IsString()
  @Length(1, 1024)
  cursor?: string;
}
export class PageDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 50, default: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 20;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 1024)
  cursor?: string;
}
export class SkillQueryDto extends PageDto {
  @ApiPropertyOptional({ minLength: 2, maxLength: 100 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(2, 100)
  q?: string;
  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  categoryId?: string;
}
export class AdminSkillQueryDto extends SkillQueryDto {
  @ApiPropertyOptional({ enum: ["ACTIVE", "INACTIVE", "ARCHIVED"] })
  @IsOptional()
  @IsIn(["ACTIVE", "INACTIVE", "ARCHIVED"])
  status?: "ACTIVE" | "INACTIVE" | "ARCHIVED";
}
export class CreateSkillDto {
  @ApiProperty({ minLength: 2, maxLength: 100 })
  @Transform(trim)
  @IsString()
  @Length(2, 100)
  name!: string;
  @ApiPropertyOptional({ minLength: 2, maxLength: 120 })
  @ValidateIf((_o, v) => v !== undefined)
  @Matches(/^[a-z0-9](?:[a-z0-9-]{0,118}[a-z0-9])$/)
  slug?: string;
  @ApiPropertyOptional({ maxLength: 500, nullable: true })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(0, 500)
  description?: string | null;
  @ApiPropertyOptional({ format: "uuid", nullable: true })
  @IsOptional()
  @IsUUID()
  categoryId?: string | null;
  @ApiProperty({ enum: ["ACTIVE", "INACTIVE", "ARCHIVED"] })
  @IsIn(["ACTIVE", "INACTIVE", "ARCHIVED"])
  status!: "ACTIVE" | "INACTIVE" | "ARCHIVED";
}
export class ChangeSkillDto extends PartialType(
  OmitType(CreateSkillDto, ["status"] as const),
) {
  @ApiProperty() @IsInt() @Min(1) expectedVersion!: number;
  @ApiPropertyOptional({ enum: ["ACTIVE", "INACTIVE"] })
  @ValidateIf((_o, v) => v !== undefined)
  @IsIn(["ACTIVE", "INACTIVE"])
  status?: "ACTIVE" | "INACTIVE";
}
export class VersionDto {
  @ApiProperty() @IsInt() @Min(1) expectedVersion!: number;
}
export class ArchiveSkillDto extends VersionDto {
  @ApiProperty({ minLength: 1, maxLength: 2000 })
  @Transform(trim)
  @IsString()
  @Length(1, 2000)
  reason!: string;
}
export class RestoreSkillDto extends ArchiveSkillDto {
  @ApiProperty({ enum: ["ACTIVE", "INACTIVE"] })
  @IsIn(["ACTIVE", "INACTIVE"])
  status!: "ACTIVE" | "INACTIVE";
}
