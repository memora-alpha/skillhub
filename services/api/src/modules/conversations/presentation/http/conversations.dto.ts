import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from "class-validator";
export class ConversationQueryDto {
  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1024)
  cursor?: string;
}
export class MessageQueryDto extends ConversationQueryDto {
  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @Matches(/^(?:0|[1-9]\d{0,18})$/)
  afterSequence?: string;
}
export class SendMessageDto {
  @ApiProperty({ format: "uuid" }) @IsUUID() clientMessageId!: string;
  @ApiPropertyOptional({ maxLength: 2000 })
  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @IsString()
  @MaxLength(2000)
  messageText?: string;
  @ApiPropertyOptional({ type: [String], maxItems: 5 })
  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(5)
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  attachmentFileIds?: string[];
}
export class ReadConversationDto {
  @ApiProperty({ format: "uuid" }) @IsUUID() messageId!: string;
}
