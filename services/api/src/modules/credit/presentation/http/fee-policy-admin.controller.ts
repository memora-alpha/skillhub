import {
  ApiSuccessResponse,
  ApiErrorResponse,
} from "../../../../shared/http/api-response.decorators";
import {
  FeePolicyResponse,
  ListedFeePolicyResponse,
  FeeRevenueResponse,
  CreditPolicyResponse,
} from "./fee-policy-admin.responses";
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
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
import {
  FeePolicyAdminService,
  MAX_FEE_POLICY_BPS,
  MIN_FEE_POLICY_BPS,
} from "../../application/services/fee-policy-admin.service";
import {
  FEE_POLICY_CODES,
  type FeePolicyCode,
} from "../../domain/fee-policy-codes";
export class CreateFeePolicyDto extends StaffDto {
  @ApiProperty({ enum: FEE_POLICY_CODES })
  @IsIn(FEE_POLICY_CODES)
  policyCode!: FeePolicyCode;

  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1) versionNo!: number;
  @ApiProperty({
    minimum: MIN_FEE_POLICY_BPS,
    maximum: MAX_FEE_POLICY_BPS,
    description: "Basis points: 500 means 5%",
  })
  @IsInt()
  @Min(MIN_FEE_POLICY_BPS)
  @Max(MAX_FEE_POLICY_BPS)
  feeBps!: number;
}
export class CreateMaterialFeeDto extends StaffDto {
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1) versionNo!: number;
  @ApiProperty({ minimum: MIN_FEE_POLICY_BPS, maximum: MAX_FEE_POLICY_BPS })
  @IsInt()
  @Min(MIN_FEE_POLICY_BPS)
  @Max(MAX_FEE_POLICY_BPS)
  feeBps!: number;
}
export class UpdateFeePolicyDto extends StaffDto {
  @ApiProperty({ minimum: MIN_FEE_POLICY_BPS, maximum: MAX_FEE_POLICY_BPS })
  @IsInt()
  @Min(MIN_FEE_POLICY_BPS)
  @Max(MAX_FEE_POLICY_BPS)
  feeBps!: number;
}
export class NextFeePolicyVersionQuery {
  @ApiProperty({ enum: FEE_POLICY_CODES })
  @IsIn(FEE_POLICY_CODES)
  policyCode!: FeePolicyCode;
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
  @Get("fee-policies/current")
  @ApiSuccessResponse(200, ListedFeePolicyResponse, { isArray: true })
  async current(@CurrentIdentity() actor: Principal) {
    return success(await this.fees.current(actor));
  }
  @Get("fee-policies/next-version")
  async nextVersion(
    @CurrentIdentity() actor: Principal,
    @Query() query: NextFeePolicyVersionQuery,
  ) {
    return success(await this.fees.nextVersion(actor, query.policyCode));
  }
  @Get("credit-policy")
  @ApiSuccessResponse(200, CreditPolicyResponse)
  async creditPolicy(@CurrentIdentity() actor: Principal) {
    return success(await this.fees.creditPolicy(actor));
  }
  @Post("fee-policies")
  @ApiSuccessResponse(201, FeePolicyResponse)
  async createPolicy(
    @CurrentIdentity() actor: Principal,
    @Body() body: CreateFeePolicyDto,
  ) {
    return success(await this.fees.create(actor, body));
  }
  @Post("fee-policies/material")
  @ApiSuccessResponse(201, FeePolicyResponse)
  async create(
    @CurrentIdentity() actor: Principal,
    @Body() body: CreateMaterialFeeDto,
  ) {
    return success(
      await this.fees.create(actor, {
        ...body,
        policyCode: "MATERIAL_PAID",
      }),
    );
  }
  @Patch("fee-policies/:id")
  @ApiSuccessResponse(200, FeePolicyResponse)
  async updateDraft(
    @CurrentIdentity() actor: Principal,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: UpdateFeePolicyDto,
  ) {
    return success(await this.fees.updateDraft(actor, id, body));
  }
  @Delete("fee-policies/:id")
  async deleteDraft(
    @CurrentIdentity() actor: Principal,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: StaffDto,
  ) {
    return success(await this.fees.deleteDraft(actor, id, body));
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
