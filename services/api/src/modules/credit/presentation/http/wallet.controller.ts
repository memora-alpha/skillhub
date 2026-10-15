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
import {
  ApiErrorResponse,
  ApiSuccessResponse,
} from "../../../../shared/http/api-response.decorators";
import { paginated, success } from "../../../../shared/http/response";
import { GetWalletUseCase } from "../../application/use-cases/get-wallet.use-case";
import { ListCreditTransactionsUseCase } from "../../application/use-cases/list-credit-transactions.use-case";
import { GetCreditTransactionUseCase } from "../../application/use-cases/get-credit-transaction.use-case";
import { LedgerQueryDto } from "./wallet.dto";
import { LedgerEntryResponse, WalletResponse } from "./wallet.responses";

@ApiTags("credit")
@ApiBearerAuth()
@UseGuards(IdentityGuard)
@ApiErrorResponse(400)
@ApiErrorResponse(401)
@ApiErrorResponse(403)
@ApiErrorResponse(404)
@Controller({ path: "me/wallet", version: "1" })
export class WalletController {
  constructor(
    private readonly getWallet: GetWalletUseCase,
    private readonly listTransactions: ListCreditTransactionsUseCase,
    private readonly getTransaction: GetCreditTransactionUseCase,
  ) {}

  @Get()
  @ApiSuccessResponse(200, WalletResponse)
  @ApiOperation({ summary: "Read own available and held Credit" })
  async wallet(@CurrentIdentity() principal: Principal) {
    return success(await this.getWallet.execute(principal));
  }

  @Get("transactions")
  @ApiSuccessResponse(200, LedgerEntryResponse, { paginated: true })
  @ApiOperation({ summary: "Read own ledger in stable snapshot order" })
  async transactions(
    @CurrentIdentity() principal: Principal,
    @Query() query: LedgerQueryDto,
  ) {
    const result = await this.listTransactions.execute(principal, query);
    return paginated(result.data, result.pagination);
  }

  @Get("transactions/:id")
  @ApiSuccessResponse(200, LedgerEntryResponse)
  @ApiOperation({ summary: "Read one own ledger entry" })
  async detail(
    @CurrentIdentity() principal: Principal,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return success(await this.getTransaction.execute(principal, id));
  }
}
