import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  Matches,
  Max,
  Min,
  ValidateNested,
} from "class-validator";

export class ScheduleItemDto {
  @IsInt()
  @Min(1)
  sessionNo!: number;

  @IsDateString({ strict: true })
  @Matches(/(?:Z|[+-]\d{2}:\d{2})$/)
  startAt!: string;

  @IsDateString({ strict: true })
  @Matches(/(?:Z|[+-]\d{2}:\d{2})$/)
  endAt!: string;
}

export class CreateScheduleProposalDto {
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  expectedPlanVersion!: number;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ScheduleItemDto)
  items!: ScheduleItemDto[];
}

export class ConfirmScheduleDto {
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  expectedVersion!: number;
}

export class RescheduleSessionDto extends ConfirmScheduleDto {
  @IsDateString({ strict: true })
  @Matches(/(?:Z|[+-]\d{2}:\d{2})$/)
  startAt!: string;

  @IsDateString({ strict: true })
  @Matches(/(?:Z|[+-]\d{2}:\d{2})$/)
  endAt!: string;
}
