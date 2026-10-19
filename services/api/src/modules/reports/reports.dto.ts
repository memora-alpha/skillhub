import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from "class-validator";

export class CreateSessionReportDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  reasonCode!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  description!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsUUID("4", { each: true })
  evidenceFileIds: string[] = [];
}
