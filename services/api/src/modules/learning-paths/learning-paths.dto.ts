import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsIn,
  IsArray,
  IsInt,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
  ValidateIf,
} from "class-validator";

export class CreateLearningPathDto {
  @IsUUID()
  conversationId!: string;

  @IsIn(["TWO_WAY", "ONE_WAY"])
  exchangeType!: "TWO_WAY" | "ONE_WAY";

  @ValidateIf(
    (value: CreateLearningPathDto) => value.exchangeType === "ONE_WAY",
  )
  @IsUUID()
  teacherId?: string;

  @ValidateIf(
    (value: CreateLearningPathDto) => value.exchangeType === "ONE_WAY",
  )
  @IsUUID()
  learnerId?: string;

  @ValidateIf(
    (value: CreateLearningPathDto) => value.exchangeType === "ONE_WAY",
  )
  @IsString()
  @MaxLength(13)
  negotiatedCredit?: string;

  @ValidateIf(
    (value: CreateLearningPathDto) => value.exchangeType === "TWO_WAY",
  )
  @IsString()
  @MaxLength(13)
  totalCreditPerUser?: string;
}

export class ChangeLearningPathDto {
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @IsIn(["TWO_WAY", "ONE_WAY"])
  exchangeType!: "TWO_WAY" | "ONE_WAY";

  @ValidateIf(
    (value: ChangeLearningPathDto) => value.exchangeType === "ONE_WAY",
  )
  @IsUUID()
  teacherId?: string;

  @ValidateIf(
    (value: ChangeLearningPathDto) => value.exchangeType === "ONE_WAY",
  )
  @IsUUID()
  learnerId?: string;

  @ValidateIf(
    (value: ChangeLearningPathDto) => value.exchangeType === "ONE_WAY",
  )
  @IsString()
  @MaxLength(13)
  negotiatedCredit?: string;

  @ValidateIf(
    (value: ChangeLearningPathDto) => value.exchangeType === "TWO_WAY",
  )
  @IsString()
  @MaxLength(13)
  totalCreditPerUser?: string;
}

export class SessionOutlineDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content!: string;
}

export class CreateLearningPlanDto {
  @IsUUID()
  skillId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(1500)
  learningGoal!: string;

  @IsInt()
  @Min(1)
  @Max(100)
  totalSessions!: number;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => SessionOutlineDto)
  sessionOutline!: SessionOutlineDto[];
}

export class ConfirmVersionDto {
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}

export class ReviseLearningPlanDto extends CreateLearningPlanDto {
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}
