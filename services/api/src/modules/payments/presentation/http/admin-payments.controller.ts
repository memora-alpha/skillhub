import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiPropertyOptional,
  ApiTags,
} from "@nestjs/swagger";
import {
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from "class-validator";
import { PaymentStatus } from "../../../../generated/prisma/client";
import {
  CurrentIdentity,
  IdentityGuard,
} from "../../../../shared/auth/identity.guard";
import type { Principal } from "../../../auth/application/services/sessions.service";
import { paginated, success } from "../../../../shared/http/response";
import { AdminFinancePageDto } from "../../../credit/presentation/http/admin-finance.dto";
import { AdminPaymentsReader } from "../../application/services/admin-payments.reader";

export class AdminPaymentQueryDto extends AdminFinancePageDto {
  @ApiPropertyOptional({ enum: PaymentStatus })
  @IsOptional()
  @IsIn(Object.values(PaymentStatus))
  status?: PaymentStatus;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^[1-9]\d{0,15}$/)
  orderCode?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  gatewayTransactionId?: string;
}
@ApiTags("admin-payments")
@ApiBearerAuth()
@UseGuards(IdentityGuard)
@Controller({ path: "admin/payments", version: "1" })
export class AdminPaymentsController {
  constructor(private readonly reader: AdminPaymentsReader) {}
  @Get()
  @ApiOperation({
    summary:
      "Admin reads all top-up payments; REVIEW filter provides review queue",
  })
  async list(
    @CurrentIdentity() actor: Principal,
    @Query() query: AdminPaymentQueryDto,
  ) {
    const result = await this.reader.list(actor, query);
    return paginated(result.data, result.pagination);
  }
  @Get(":id")
  @ApiOperation({ summary: "Admin reads a payment and its ledger link" })
  async detail(
    @CurrentIdentity() actor: Principal,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return success(await this.reader.detail(actor, id));
  }
  @Get(":id/reconciliation")
  @ApiOperation({
    summary:
      "Admin reads database reconciliation; never changes payment or wallet",
  })
  async report(
    @CurrentIdentity() actor: Principal,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return success(await this.reader.report(actor, id));
  }
}
