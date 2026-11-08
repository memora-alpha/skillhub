import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  IsIn,
} from "class-validator";
import {
  CreditReferenceType,
  CreditTransactionStatus,
  CreditTransactionType,
} from "../../../../generated/prisma/client";
export class AdminFinancePageDto {
  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  cursor?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() userId?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601({ strict: true })
  from?: string;
  @ApiPropertyOptional() @IsOptional() @IsISO8601({ strict: true }) to?: string;
}
export class AdminLedgerQueryDto extends AdminFinancePageDto {
  @ApiPropertyOptional({ enum: CreditTransactionType })
  @IsOptional()
  @IsIn(Object.values(CreditTransactionType))
  type?: CreditTransactionType;
  @ApiPropertyOptional({ enum: CreditTransactionStatus })
  @IsOptional()
  @IsIn(Object.values(CreditTransactionStatus))
  status?: CreditTransactionStatus;
  @ApiPropertyOptional() @IsOptional() @IsUUID() operationId?: string;
  @ApiPropertyOptional({ enum: CreditReferenceType })
  @IsOptional()
  @IsIn(Object.values(CreditReferenceType))
  referenceType?: CreditReferenceType;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  referenceId?: string;
}
