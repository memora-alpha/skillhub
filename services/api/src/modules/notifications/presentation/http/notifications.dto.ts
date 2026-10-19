import { Type } from "class-transformer";
import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class ListNotificationsDto {
  @ApiPropertyOptional({
    type: "integer",
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    maxLength: 200,
    description: "Use nextCursor from the previous inbox page.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  cursor?: string;
}
