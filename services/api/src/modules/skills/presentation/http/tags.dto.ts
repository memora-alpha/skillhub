import {
  ApiProperty,
  ApiPropertyOptional,
  OmitType,
  PartialType,
} from "@nestjs/swagger";
import { IsIn, IsInt, IsOptional, IsString, Min } from "class-validator";
import type {
  Tag,
  TagCreationRequest,
} from "../../../../generated/prisma/client";
import { TagQueryDto } from "./skills.dto";

export class CreateTagDto {
  @ApiProperty({
    minLength: 1,
    maxLength: 80,
    description:
      "NFC label, whitespace collapsed; control characters rejected.",
  })
  @IsString()
  label!: string;
}
export class ApproveTagRequestDto {
  @ApiProperty({ minimum: 1, type: "integer" })
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}
export class RejectTagRequestDto extends ApproveTagRequestDto {
  @ApiProperty({ minLength: 1, maxLength: 2000 })
  @IsString()
  reason!: string;
}
export class UpdateTagDto extends PartialType(CreateTagDto, {
  skipNullProperties: false,
}) {
  @ApiPropertyOptional({ enum: ["ACTIVE", "INACTIVE"] })
  @IsOptional()
  @IsIn(["ACTIVE", "INACTIVE"])
  status?: "ACTIVE" | "INACTIVE";
  @ApiProperty({ minimum: 1, type: "integer" })
  @IsInt()
  @Min(1)
  expectedVersion!: number;
  @ApiProperty({ minLength: 1, maxLength: 2000 })
  @IsString()
  reason!: string;
}
export class AdminTagQueryDto extends TagQueryDto {
  @ApiPropertyOptional({ enum: ["ACTIVE", "INACTIVE", "ARCHIVED"] })
  @IsOptional()
  @IsIn(["ACTIVE", "INACTIVE", "ARCHIVED"])
  status?: "ACTIVE" | "INACTIVE" | "ARCHIVED";
}
export class TagRequestQueryDto extends OmitType(TagQueryDto, ["q"] as const) {
  @ApiPropertyOptional({ enum: ["PENDING", "APPROVED", "REJECTED"] })
  @IsOptional()
  @IsIn(["PENDING", "APPROVED", "REJECTED"])
  status?: "PENDING" | "APPROVED" | "REJECTED";
}
export class AdminTagResponse {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty({ maxLength: 80 }) label!: string;
  @ApiProperty({ enum: ["ACTIVE", "INACTIVE", "ARCHIVED"] }) status!: string;
  @ApiProperty({ type: String, format: "uuid", nullable: true })
  createdByUserId!: string | null;
  @ApiProperty({ type: Date, nullable: true, format: "date-time" })
  createdAt!: Date | null;
  @ApiProperty({ format: "date-time" }) updatedAt!: Date;
  @ApiProperty({ minimum: 1, type: "integer" }) version!: number;
}
export class TagRequestResponse {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty({ maxLength: 80 }) label!: string;
  @ApiProperty({ enum: ["PENDING", "APPROVED", "REJECTED"] }) status!: string;
  @ApiProperty({ format: "uuid" }) requestedByUserId!: string;
  @ApiProperty({ type: String, format: "uuid", nullable: true })
  reviewedByUserId!: string | null;
  @ApiProperty({ type: Date, format: "date-time", nullable: true })
  reviewedAt!: Date | null;
  @ApiProperty({ type: String, format: "uuid", nullable: true }) resultTagId!:
    string | null;
  @ApiProperty({ type: String, nullable: true }) rejectReason!: string | null;
  @ApiProperty({ format: "date-time" }) createdAt!: Date;
  @ApiProperty({ format: "date-time" }) updatedAt!: Date;
  @ApiProperty({ minimum: 1, type: "integer" }) version!: number;
}
export function tagResponse(row: Tag): AdminTagResponse {
  return {
    id: row.id,
    label: row.label,
    status: row.status,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    version: row.version,
  };
}
export function tagRequestResponse(
  row: TagCreationRequest,
): TagRequestResponse {
  return {
    id: row.id,
    label: row.label,
    status: row.status,
    requestedByUserId: row.requestedByUserId,
    reviewedByUserId: row.reviewedByUserId,
    reviewedAt: row.reviewedAt,
    resultTagId: row.resultTagId,
    rejectReason: row.rejectReason,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    version: row.version,
  };
}
