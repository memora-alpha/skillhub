import {
  ApiProperty,
  ApiPropertyOptional,
  PartialType,
  OmitType,
} from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsUUID,
  IsIn,
  IsString,
  Length,
  IsBoolean,
  IsOptional,
  Matches,
  IsInt,
  Min,
  ValidateIf,
} from "class-validator";
import { PageDto } from "../../../skills/presentation/http/skills.dto";
import type { SharingSkillLevel } from "../../../../generated/prisma/client";
const bool = ({ value }: { value: unknown }) => {
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
};
export class SharingQueryDto extends PageDto {
  @ApiPropertyOptional({ default: false })
  @ValidateIf((_o, v) => v !== undefined)
  @Transform(bool)
  @IsBoolean()
  includeArchived?: boolean;
}
export class SharerQueryDto extends PageDto {
  @ApiPropertyOptional({ default: false })
  @ValidateIf((_o, v) => v !== undefined)
  @Transform(bool)
  @IsBoolean()
  verifiedOnly?: boolean;
}
export class CreateSharingDto {
  @ApiProperty({ format: "uuid" }) @IsUUID() skillId!: string;
  @ApiProperty({ enum: ["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"] })
  @IsIn(["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"])
  level!: SharingSkillLevel;
  @ApiProperty({ minLength: 20, maxLength: 1500 })
  @IsString()
  @Length(20, 1500)
  description!: string;
  @ApiPropertyOptional({ type: String, nullable: true, example: "2.5" })
  @IsOptional()
  @Matches(/^(?:[0-5]?\d(?:\.\d)?|60(?:\.0)?)$/)
  experienceYears?: string | null;
  @ApiPropertyOptional({ default: true })
  @ValidateIf((_o, v) => v !== undefined)
  @IsBoolean()
  isVisible?: boolean;
}
export class ChangeSharingDto extends PartialType(
  OmitType(CreateSharingDto, ["skillId"] as const),
) {
  @ApiProperty() @IsInt() @Min(1) expectedVersion!: number;
}
