import {
  ApiProperty,
  ApiPropertyOptional,
  OmitType,
  PartialType,
} from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from "class-validator";

export class CreateSkillLevelDto {
  @ApiProperty({ minLength: 1, maxLength: 2000 })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(1, 2000)
  reason!: string;
  @ApiProperty({ example: "B2", maxLength: 40 })
  @Matches(/^[A-Z0-9][A-Z0-9_-]{0,39}$/u)
  code!: string;

  @ApiProperty({ minLength: 2, maxLength: 100 })
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim().normalize("NFC") : value,
  )
  @IsString()
  @Length(2, 100)
  name!: string;

  @ApiPropertyOptional({ nullable: true, type: String, maxLength: 500 })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  description?: string | null;

  @ApiProperty({ minimum: 0, maximum: 100000 })
  @IsInt()
  @Min(0)
  @Max(100000)
  sortOrder!: number;

  @ApiProperty({ enum: ["ACTIVE", "INACTIVE"] })
  @IsIn(["ACTIVE", "INACTIVE"])
  status!: "ACTIVE" | "INACTIVE";
}

export class UpdateSkillLevelDto extends PartialType(
  OmitType(CreateSkillLevelDto, ["code", "reason"] as const),
  { skipNullProperties: false },
) {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @ApiProperty({ minLength: 1, maxLength: 2000 })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(1, 2000)
  reason!: string;
}

export class SkillLevelResponse {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty({ format: "uuid" }) skillId!: string;
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ type: String, nullable: true }) description!: string | null;
  @ApiProperty() sortOrder!: number;
  @ApiProperty({ enum: ["ACTIVE", "INACTIVE"] }) status!: string;
  @ApiProperty() version!: number;
  @ApiProperty({ format: "date-time" }) createdAt!: Date;
  @ApiProperty({ format: "date-time" }) updatedAt!: Date;
}
