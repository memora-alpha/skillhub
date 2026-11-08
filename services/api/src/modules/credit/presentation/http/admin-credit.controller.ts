import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  CurrentIdentity,
  IdentityGuard,
} from "../../../../shared/auth/identity.guard";
import type { Principal } from "../../../auth/application/services/sessions.service";
import { paginated, success } from "../../../../shared/http/response";
import { AdminCreditReader } from "../../application/services/admin-credit.reader";
import { AdminLedgerQueryDto } from "./admin-finance.dto";
@ApiTags("admin-credit")
@ApiBearerAuth()
@UseGuards(IdentityGuard)
@Controller({ path: "admin", version: "1" })
export class AdminCreditController {
  constructor(private readonly reader: AdminCreditReader) {}
  @Get("credit/transactions")
  @ApiOperation({ summary: "Admin reads system ledger; read only" })
  async list(
    @CurrentIdentity() actor: Principal,
    @Query() query: AdminLedgerQueryDto,
  ) {
    const result = await this.reader.list(actor, query);
    return paginated(result.data, result.pagination);
  }
  @Get("credit/transactions/:id")
  @ApiOperation({ summary: "Admin reads ledger entry and business reference" })
  async detail(
    @CurrentIdentity() actor: Principal,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return success(await this.reader.detail(actor, id));
  }
  @Get("credit/operations/:id")
  @ApiOperation({ summary: "Admin reads an operation and its entries" })
  async operation(
    @CurrentIdentity() actor: Principal,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return success(await this.reader.operation(actor, id));
  }
  @Get("users/:userId/wallet")
  @ApiOperation({ summary: "Admin reads a user's Available and Held Credit" })
  async wallet(
    @CurrentIdentity() actor: Principal,
    @Param("userId", ParseUUIDPipe) id: string,
  ) {
    return success(await this.reader.wallet(actor, id));
  }
}
