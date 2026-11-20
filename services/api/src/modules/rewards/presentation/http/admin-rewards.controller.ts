import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  CurrentIdentity,
  IdentityGuard,
} from "../../../../shared/auth/identity.guard";
import { paginated, success } from "../../../../shared/http/response";
import type { Principal } from "../../../auth/application/services/sessions.service";
import { parseCredit } from "../../../credit/domain/money";
import { RedemptionService } from "../../application/services/redemption.service";
import { RewardCatalogService } from "../../application/services/reward-catalog.service";
import {
  AdminProductQueryDto,
  AdminRedemptionQueryDto,
  ResolveRedemptionDto,
  UpdateProductDto,
} from "./rewards.dto";

@ApiTags("admin-rewards")
@ApiBearerAuth()
@UseGuards(IdentityGuard)
@Controller({ path: "admin/rewards", version: "1" })
export class AdminRewardsController {
  constructor(
    private readonly catalog: RewardCatalogService,
    private readonly redemptions: RedemptionService,
  ) {}

  @Get("products")
  async products(
    @CurrentIdentity() actor: Principal,
    @Query() query: AdminProductQueryDto,
  ) {
    const page = await this.catalog.adminList(actor, query);
    return paginated(page.data, page.pagination);
  }

  @Patch("products/:productId")
  async updateProduct(
    @CurrentIdentity() actor: Principal,
    @Param("productId", ParseUUIDPipe) id: string,
    @Body() body: UpdateProductDto,
  ) {
    const { priceCredit, ...rest } = body;
    return success(
      await this.catalog.adminUpdate(actor, id, {
        ...rest,
        ...(priceCredit === undefined
          ? {}
          : {
              priceCredit:
                priceCredit === null ? null : parseCredit(priceCredit),
            }),
      }),
      "Reward product updated.",
    );
  }

  @Post("catalog/sync")
  async sync(@CurrentIdentity() actor: Principal) {
    return success(await this.catalog.adminSync(actor), "Catalog synced.");
  }

  @Get("redemptions")
  async list(
    @CurrentIdentity() actor: Principal,
    @Query() query: AdminRedemptionQueryDto,
  ) {
    const page = await this.redemptions.adminList(actor, query);
    return paginated(page.data, page.pagination);
  }

  @Post("redemptions/:redemptionId/resolve")
  async resolve(
    @CurrentIdentity() actor: Principal,
    @Param("redemptionId", ParseUUIDPipe) id: string,
    @Body() body: ResolveRedemptionDto,
  ) {
    return success(
      await this.redemptions.resolve(actor, id, {
        action: body.action,
        reason: body.reason,
        voucher: body.voucher && {
          ...body.voucher,
          expiresAt: body.voucher.expiresAt
            ? new Date(body.voucher.expiresAt)
            : null,
        },
      }),
      "Redemption resolved.",
    );
  }

  @Get("budget")
  async budget(@CurrentIdentity() actor: Principal) {
    return success(await this.redemptions.budget(actor));
  }
}
