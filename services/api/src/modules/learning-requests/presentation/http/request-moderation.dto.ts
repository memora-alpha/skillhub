import {
  IsInt,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

export class ApproveLearningRequestDto {
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  expectedVersion!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  reason!: string;
}

export class RejectLearningRequestDto {
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  expectedVersion!: number;

  @IsString()
  @MinLength(10)
  @MaxLength(500)
  reason!: string;
}
