import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiHeader, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import {
  CurrentIdentity,
  IdentityGuard,
} from "../../../../shared/auth/identity.guard";
import { ListPageQuery } from "../../../../shared/http/list-page";
import { paginated, success } from "../../../../shared/http/response";
import type { Principal } from "../../../auth/application/services/sessions.service";
import { RedemptionService } from "../../application/services/redemption.service";
import { RewardCatalogService } from "../../application/services/reward-catalog.service";
import { LocaleQueryDto, ProductQueryDto, RedeemDto } from "./rewards.dto";

@ApiTags("rewards")
@ApiBearerAuth()
@UseGuards(IdentityGuard)
@Controller({ version: "1" })
export class RewardsController {
  constructor(
    private readonly catalog: RewardCatalogService,
    private readonly redemptions: RedemptionService,
  ) {}

  @Get("rewards/products")
  async products(@Query() query: ProductQueryDto) {
    return success(await this.catalog.listActive(query, query.locale ?? "vi"));
  }

  @Get("rewards/products/:productId")
  async product(
    @Param("productId", ParseUUIDPipe) id: string,
    @Query() query: LocaleQueryDto,
  ) {
    return success(await this.catalog.get(id, query.locale ?? "vi"));
  }

  @Post("rewards/redemptions")
  @Header("Cache-Control", "no-store")
  @ApiHeader({ name: "Idempotency-Key", required: true })
  async redeem(
    @CurrentIdentity() actor: Principal,
    @Headers("idempotency-key") key: string | undefined,
    @Body() body: RedeemDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const redemption = await this.redemptions.redeem(actor, body, key);
    // 201 once issued; 202 while the provider outcome is still being reconciled.
    response.status(redemption.status === "ISSUED" ? 201 : 202);
    return success(redemption, "Voucher redemption accepted.");
  }

  /** Settle an uncertain redeem: the redemption made with this key, or 404 if it never will be. */
  @Post("rewards/redemptions/lookup")
  @HttpCode(200)
  @Header("Cache-Control", "no-store")
  @ApiHeader({ name: "Idempotency-Key", required: true })
  async lookup(
    @CurrentIdentity() actor: Principal,
    @Headers("idempotency-key") key: string | undefined,
  ) {
    return success(await this.redemptions.lookup(actor, key));
  }

  @Get("rewards/redemptions")
  @Header("Cache-Control", "no-store")
  async list(
    @CurrentIdentity() actor: Principal,
    @Query() query: ListPageQuery,
  ) {
    const page = await this.redemptions.list(actor, query);
    return paginated(page.data, page.pagination);
  }

  @Get("rewards/redemptions/:redemptionId")
  @Header("Cache-Control", "no-store")
  async detail(
    @CurrentIdentity() actor: Principal,
    @Param("redemptionId", ParseUUIDPipe) id: string,
  ) {
    return success(await this.redemptions.get(actor, id));
  }
}
