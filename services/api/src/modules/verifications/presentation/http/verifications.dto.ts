import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  ArrayUnique,
  IsUUID,
  IsString,
  IsOptional,
  Length,
  IsIn,
  ValidateIf,
} from "class-validator";
import {
  VersionDto,
  PageDto,
} from "../../../skills/presentation/http/skills.dto";
import type { VerificationRequestStatus } from "../../../../generated/prisma/client";
export class SubmitEvidenceDto {
  @ApiProperty({ type: [String], minItems: 1, maxItems: 5 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  fileIds!: string[];
  @ApiPropertyOptional({ maxLength: 120 })
  @ValidateIf((_o, v) => v !== undefined)
  @IsString()
  @Length(0, 120)
  title?: string;
  @ApiPropertyOptional({ maxLength: 500 })
  @ValidateIf((_o, v) => v !== undefined)
  @IsString()
  @Length(0, 500)
  description?: string;
}
export class ApproveEvidenceDto extends VersionDto {
  @ApiPropertyOptional({ maxLength: 500 })
  @ValidateIf((_o, v) => v !== undefined)
  @IsString()
  @Length(0, 500)
  note?: string;
}
export class RejectEvidenceDto extends VersionDto {
  @ApiProperty({ minLength: 10, maxLength: 500 })
  @IsString()
  @Length(10, 500)
  rejectReason!: string;
}
export class RevokeEvidenceDto {
  @ApiProperty({ minLength: 10, maxLength: 500 })
  @IsString()
  @Length(10, 500)
  reason!: string;
}
export class VerificationQueryDto extends PageDto {
  @ApiPropertyOptional({ enum: ["PENDING", "APPROVED", "REJECTED"] })
  @IsOptional()
  @IsIn(["PENDING", "APPROVED", "REJECTED"])
  status?: VerificationRequestStatus;
}
