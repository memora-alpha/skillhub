import {
  IsBoolean,
  MinLength,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";
import { Transform } from "class-transformer";

export class LiveKitTokenRequestDto {}

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
