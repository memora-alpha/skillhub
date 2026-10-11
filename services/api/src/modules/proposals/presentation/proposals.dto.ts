import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
class CandidateSlotDto {
  @ApiProperty() @IsISO8601() startAt!: string;
  @ApiProperty() @IsISO8601() endAt!: string;
}
export class ProposalHintsDto {
  @ApiProperty({ minLength: 10, maxLength: 1000 }) @IsString() message!: string;
  @ApiPropertyOptional({ enum: ["ONE_WAY", "TWO_WAY"], nullable: true })
  @IsOptional()
  @IsIn(["ONE_WAY", "TWO_WAY"])
  exchangeTypeHint?: "ONE_WAY" | "TWO_WAY" | null;
  @ApiPropertyOptional({ type: String, nullable: true, example: "20.00" })
  @IsOptional()
  @IsString()
  proposedCredit?: string | null;
  @ApiPropertyOptional({ minimum: 60, maximum: 180, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(60)
  @Max(180)
  proposedDurationMinutes?: number | null;
  @ApiPropertyOptional({ minimum: 1, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(32767)
  initialSessionCount?: number | null;
  @ApiPropertyOptional({ type: [CandidateSlotDto], maxItems: 5 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => CandidateSlotDto)
  candidateSlots?: CandidateSlotDto[];
}
export class CreateProposalDto extends ProposalHintsDto {
  @ApiProperty({ enum: ["LEARNING_REQUEST", "DIRECT_SEARCH"] })
  @IsIn(["LEARNING_REQUEST", "DIRECT_SEARCH"])
  sourceType!: "LEARNING_REQUEST" | "DIRECT_SEARCH";
  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  learningRequestId?: string;
  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  recipientSharingSkillId?: string;
}
export class ChangeProposalDto extends PartialType(ProposalHintsDto) {
  @ApiProperty() @IsInt() @Min(1) expectedVersion!: number;
}
export class DecideProposalDto {
  @ApiProperty() @IsInt() @Min(1) expectedVersion!: number;
}
export class AcceptProposalDto extends DecideProposalDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  expectedRequestVersion?: number;
}
export class ProposalQueryDto {
  @ApiPropertyOptional({ enum: ["sent", "received"] })
  @IsOptional()
  @IsIn(["sent", "received"])
  direction?: "sent" | "received";
  @ApiPropertyOptional({
    enum: ["PENDING", "ACCEPTED", "REJECTED", "WITHDRAWN", "EXPIRED"],
  })
  @IsOptional()
  @IsIn(["PENDING", "ACCEPTED", "REJECTED", "WITHDRAWN", "EXPIRED"])
  status?: "PENDING" | "ACCEPTED" | "REJECTED" | "WITHDRAWN" | "EXPIRED";
  @ApiPropertyOptional() @IsOptional() @IsUUID() learningRequestId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() cursor?: string;
  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
