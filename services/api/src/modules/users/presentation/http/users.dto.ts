import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from "class-validator";
import { Policy } from "../../../auth/presentation/http/auth.dto";
import { validFullName, validTimezone } from "../../domain/profile-policy";

export class ProfileDto {
  @ApiPropertyOptional({ minLength: 2, maxLength: 100 })
  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @Policy(validFullName)
  fullName?: string;
  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @Length(0, 120)
  headline?: string;
  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  bio?: string;
  @ApiPropertyOptional() @IsOptional() @Policy(validTimezone) timezone?: string;
  @ApiPropertyOptional({ enum: ["vi", "en"] })
  @IsOptional()
  @IsIn(["vi", "en"])
  locale?: "vi" | "en";
}
export class ReasonDto {
  @ApiProperty({ minLength: 1, maxLength: 1000 })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(1, 1000)
  reason!: string;
}
export class StaffDto extends ReasonDto {
  @ApiProperty({ writeOnly: true })
  @IsString()
  @Length(1, 1024)
  reauthToken!: string;
}
export class UserListDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 2048)
  cursor?: string;
  @ApiPropertyOptional({
    enum: [
      "PENDING_VERIFICATION",
      "ACTIVE",
      "LOCKED",
      "SUSPENDED",
      "DEACTIVATED",
    ],
  })
  @IsOptional()
  @IsIn([
    "PENDING_VERIFICATION",
    "ACTIVE",
    "LOCKED",
    "SUSPENDED",
    "DEACTIVATED",
  ])
  status?:
    "PENDING_VERIFICATION" | "ACTIVE" | "LOCKED" | "SUSPENDED" | "DEACTIVATED";
  @ApiPropertyOptional({ enum: ["USER", "STAFF", "ADMIN"] })
  @IsOptional()
  @IsIn(["USER", "STAFF", "ADMIN"])
  role?: "USER" | "STAFF" | "ADMIN";
}
