import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Injectable,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsInt,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  ValidateIf,
} from "class-validator";
import {
  CurrentIdentity,
  IdentityGuard,
} from "../../shared/auth/identity.guard";
import { success } from "../../shared/http/response";
import { ApiSuccessResponse } from "../../shared/http/api-response.decorators";
import type { Principal } from "../auth/application/services/sessions.service";
import { AdminQaAdjustmentsService } from "./admin-qa-adjustments.service";

class AdjustmentReasonDto {
  @ApiProperty({ minLength: 1, maxLength: 1000 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsString()
  @Length(1, 1000)
  reason!: string;
}

const positiveCreditAmount = /^[1-9]\d{0,9}$/;

class CreditAdjustmentDto extends AdjustmentReasonDto {
  @ApiProperty({ example: "100", pattern: positiveCreditAmount.source })
  @IsString()
  @Matches(positiveCreditAmount)
  amount!: string;
}

class ReputationAdjustmentDto extends AdjustmentReasonDto {
  @ApiProperty({ example: 50, minimum: 0, maximum: 100 })
  @IsInt()
  @Min(0)
  @Max(100)
  targetScore!: number;

  @ApiPropertyOptional({
    type: Boolean,
    default: false,
    description: "Requires targetScore >= 40",
  })
  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsBoolean()
  releaseLowReputationRestrictions?: boolean;
}

class CreditAdjustmentResponse {
  @ApiProperty({ format: "uuid" }) operationId!: string;
  @ApiProperty({ example: "0.00" }) availableBefore!: string;
  @ApiProperty({ example: "100.00" }) availableAfter!: string;
}

class ReputationAdjustmentResponse {
  @ApiProperty({ format: "uuid" }) historyId!: string;
  @ApiProperty({ example: 39 }) scoreBefore!: number;
  @ApiProperty({ example: 50 }) scoreAfter!: number;
  @ApiProperty({ example: "NORMAL" }) level!: string;
}

@Injectable()
class QaAdjustmentsEnabledGuard {
  constructor(private readonly adjustments: AdminQaAdjustmentsService) {}

  canActivate() {
    this.adjustments.requireEnabled();
    return true;
  }
}

@ApiTags("admin-qa-adjustments")
@ApiBearerAuth()
@ApiHeader({ name: "Idempotency-Key", required: true })
@ApiResponse({
  status: 400,
  description: "Invalid body, user ID or idempotency key",
})
@ApiResponse({ status: 401, description: "Authentication required" })
@ApiResponse({ status: 403, description: "Admin permission required" })
@ApiResponse({ status: 404, description: "Feature disabled or user not found" })
@ApiResponse({ status: 409, description: "Adjustment or idempotency conflict" })
@UseGuards(QaAdjustmentsEnabledGuard, IdentityGuard)
@Controller({ path: "admin/users", version: "1" })
export class AdminQaAdjustmentsController {
  constructor(private readonly adjustments: AdminQaAdjustmentsService) {}

  @Post(":userId/credit-adjustments")
  @HttpCode(200)
  @ApiOperation({ summary: "Grant test credit (ADMIN and credit:adjust:qa)" })
  @ApiSuccessResponse(200, CreditAdjustmentResponse)
  async grantCredit(
    @CurrentIdentity() actor: Principal,
    @Param("userId", ParseUUIDPipe) userId: string,
    @Body() body: CreditAdjustmentDto,
    @Headers("idempotency-key") key: string | undefined,
  ) {
    return success(
      await this.adjustments.grantCredit(actor, userId, body, key),
    );
  }

  @Post(":userId/reputation-adjustments")
  @HttpCode(200)
  @ApiOperation({
    summary: "Set test reputation (ADMIN and reputation:adjust:qa)",
  })
  @ApiSuccessResponse(200, ReputationAdjustmentResponse)
  async setReputation(
    @CurrentIdentity() actor: Principal,
    @Param("userId", ParseUUIDPipe) userId: string,
    @Body() body: ReputationAdjustmentDto,
    @Headers("idempotency-key") key: string | undefined,
  ) {
    return success(
      await this.adjustments.setReputation(actor, userId, body, key),
    );
  }
}
