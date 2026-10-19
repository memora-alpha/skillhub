import {
  IsInt,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class ApproveLearningRequestDto {
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
    minLength: 1,
    maxLength: 2000,
    description: "Reason recorded in the moderation audit.",
  })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  reason!: string;
}

export class RejectLearningRequestDto {
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
    minLength: 10,
    maxLength: 500,
    description:
      "Plain-text rejection reason saved and sent to the request owner.",
  })
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  reason!: string;
}
