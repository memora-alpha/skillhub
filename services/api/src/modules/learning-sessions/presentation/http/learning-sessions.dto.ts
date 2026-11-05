import {
  IsBoolean,
  MinLength,
  IsOptional,
  IsString,
  MaxLength,
  IsInt,
  Min,
} from "class-validator";
import { Transform } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";

export class LiveKitTokenRequestDto {}

export class ApproveImmediateSettlementDto {
  @ApiProperty({
    minimum: 1,
    description: "Locked agreement version from settlement-status",
  })
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}

export class ConfirmSessionCompletionDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note = "";
}

export class SubmitAbsenceExcuseDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  reason!: string;
}

export class DecideAbsenceExcuseDto {
  @IsBoolean()
  accept!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
