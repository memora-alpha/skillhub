import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsString, MaxLength, ValidateIf } from "class-validator";
import { dashboardGranularities, dashboardTimezones } from "./dashboard-period";

export class AdminDashboardQuery {
  @ApiProperty({
    format: "date-time",
    description: "Inclusive RFC 3339 timestamp",
  })
  @IsString()
  @MaxLength(35)
  from!: string;

  @ApiProperty({
    format: "date-time",
    description: "Exclusive RFC 3339 timestamp",
  })
  @IsString()
  @MaxLength(35)
  to!: string;

  @ApiPropertyOptional({
    enum: [...dashboardTimezones],
    default: "Asia/Ho_Chi_Minh",
  })
  @ValidateIf((_, value) => value !== undefined)
  @IsIn(dashboardTimezones)
  timezone?: string;

  @ApiPropertyOptional({ enum: [...dashboardGranularities], default: "day" })
  @ValidateIf((_, value) => value !== undefined)
  @IsIn(dashboardGranularities)
  granularity?: string;

  @ApiPropertyOptional({
    description:
      "Comma-separated sections. Omit to load all sections for the route.",
  })
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @MaxLength(200)
  sections?: string;
}
