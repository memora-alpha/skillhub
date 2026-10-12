import { Type } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";

export class ModerationRuleDto {
  @ApiProperty({
    minLength: 1,
    maxLength: 64,
    pattern: "^[A-Za-z][A-Za-z0-9_-]*$",
    example: "SAFETY",
  })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  @Matches(/^[A-Za-z][A-Za-z0-9_-]*$/u)
  category!: string;

  @ApiProperty({
    minLength: 1,
    maxLength: 120,
    example: "unsafe phrase",
    description:
      "Literal text with at least two non-wildcard characters and at most one '*' wildcard. Normalized for matching.",
  })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  pattern!: string;
}

export class UpdateLearningRequestModerationRulesDto {
  @ApiProperty({
    type: "integer",
    minimum: 1,
    maximum: Number.MAX_SAFE_INTEGER,
  })
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  expectedVersion!: number;

  @ApiProperty({
    type: [ModerationRuleDto],
    minItems: 1,
    maxItems: 250,
    description: "No duplicate category/pattern pair after normalization.",
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(250)
  @ValidateNested({ each: true })
  @Type(() => ModerationRuleDto)
  rules!: ModerationRuleDto[];

  @ApiProperty({
    minLength: 10,
    maxLength: 500,
    description: "Audit reason for changing the moderation rules.",
  })
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  reason!: string;
}
