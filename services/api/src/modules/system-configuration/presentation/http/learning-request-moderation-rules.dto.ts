import { Type } from "class-transformer";
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
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  @Matches(/^[A-Za-z][A-Za-z0-9_-]*$/u)
  category!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  pattern!: string;
}

export class UpdateLearningRequestModerationRulesDto {
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  expectedVersion!: number;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(250)
  @ValidateNested({ each: true })
  @Type(() => ModerationRuleDto)
  rules!: ModerationRuleDto[];

  @IsString()
  @MinLength(10)
  @MaxLength(500)
  reason!: string;
}
