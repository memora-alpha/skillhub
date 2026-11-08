import {
  ApiSuccessResponse,
  ApiErrorResponse,
} from "../../../../shared/http/api-response.decorators";
import {
  FeePolicyResponse,
  ListedFeePolicyResponse,
  FeeRevenueResponse,
} from "./fee-policy-admin.responses";
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from "@nestjs/swagger";
import { IsIn, IsInt, IsISO8601, IsOptional, Max, Min } from "class-validator";
import {
  CurrentIdentity,
  IdentityGuard,
} from "../../../../shared/auth/identity.guard";
import type { Principal } from "../../../auth/application/services/sessions.service";
import { success, paginated } from "../../../../shared/http/response";
import { ListPageQuery } from "../../../../shared/http/list-page";
import { StaffDto } from "../../../users/presentation/http/users.dto";
import { FeePolicyAdminService } from "../../application/services/fee-policy-admin.service";
export class CreateMaterialFeeDto extends StaffDto {
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1) versionNo!: number;
  @ApiProperty({
    minimum: 0,
    maximum: 9999,
    description: "Basis points: 500 means 5%",
  })
  @IsInt()
  @Min(0)
  @Max(9999)
  feeBps!: number;
}
export class ApproveMaterialFeeDto extends StaffDto {
  @ApiPropertyOptional({
    format: "date-time",
    description: "Omit for immediate effect; past times are rejected",
  })
  @IsOptional()
  @IsISO8601({ strict: true })
  effectiveAt?: string;
}
export class FeeRevenueQuery {
  @ApiProperty({ format: "date-time" })
  @IsISO8601({ strict: true })
  from!: string;
  @ApiProperty({ format: "date-time" })
  @IsISO8601({ strict: true })
  to!: string;
  @ApiPropertyOptional({ enum: ["day", "month"], default: "day" })
  @IsOptional()
  @IsIn(["day", "month"])
  granularity: "day" | "month" = "day";
}
@ApiTags("admin-fees")
@ApiBearerAuth()
@UseGuards(IdentityGuard)
@ApiErrorResponse(400)
@ApiErrorResponse(401)
@ApiErrorResponse(403)
@ApiErrorResponse(404)
@ApiErrorResponse(409)
@Controller({ path: "admin", version: "1" })
export class FeePolicyAdminController {
  constructor(private readonly fees: FeePolicyAdminService) {}
  @Get("fee-policies")
  @ApiSuccessResponse(200, ListedFeePolicyResponse, { paginated: true })
  async list(
    @CurrentIdentity() actor: Principal,
    @Query() query: ListPageQuery,
  ) {
    const page = await this.fees.list(actor, query);
    return paginated(page.data, page.pagination);
  }
  @Post("fee-policies/material")
  @ApiSuccessResponse(201, FeePolicyResponse)
  async create(
    @CurrentIdentity() actor: Principal,
    @Body() body: CreateMaterialFeeDto,
  ) {
    return success(await this.fees.create(actor, body));
  }
  @Post("fee-policies/:id/approve")
  @ApiSuccessResponse(201, FeePolicyResponse)
  async approve(
    @CurrentIdentity() actor: Principal,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: ApproveMaterialFeeDto,
  ) {
    return success(await this.fees.approve(actor, id, body));
  }
  @Get("fee-revenue")
  @ApiSuccessResponse(200, FeeRevenueResponse)
  async revenue(
    @CurrentIdentity() actor: Principal,
    @Query() query: FeeRevenueQuery,
  ) {
    return success(await this.fees.revenue(actor, query));
  }
}
