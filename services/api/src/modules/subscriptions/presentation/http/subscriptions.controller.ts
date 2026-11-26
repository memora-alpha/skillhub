import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiHeader, ApiTags } from "@nestjs/swagger";
import {
  CurrentIdentity,
  IdentityGuard,
} from "../../../../shared/auth/identity.guard";
import { ListPageQuery } from "../../../../shared/http/list-page";
import { paginated, success } from "../../../../shared/http/response";
import type { Principal } from "../../../auth/application/services/sessions.service";
import { parseCredit } from "../../../credit/domain/money";
import { SubscriptionPlansService } from "../../application/services/subscription-plans.service";
import { SubscriptionsService } from "../../application/services/subscriptions.service";
import {
  PurchaseSubscriptionDto,
  UpdateSubscriptionDto,
  UpgradeQuoteQueryDto,
  UpgradeSubscriptionDto,
} from "./subscriptions.dto";

@ApiTags("subscriptions")
@ApiBearerAuth()
@UseGuards(IdentityGuard)
@Controller({ version: "1" })
export class SubscriptionsController {
  constructor(
    private readonly plans: SubscriptionPlansService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  @Get("subscriptions/plans")
  async listPlans() {
    return success(await this.plans.listEffective());
  }

  @Get("me/subscription")
  @Header("Cache-Control", "no-store")
  async me(@CurrentIdentity() actor: Principal) {
    return success(await this.subscriptions.me(actor));
  }

  @Post("me/subscription")
  @Header("Cache-Control", "no-store")
  @ApiHeader({ name: "Idempotency-Key", required: true })
  async purchase(
    @CurrentIdentity() actor: Principal,
    @Headers("idempotency-key") key: string | undefined,
    @Body() body: PurchaseSubscriptionDto,
  ) {
    return success(
      await this.subscriptions.purchase(actor, body, key),
      "Subscription activated.",
    );
  }

  @Get("me/subscription/upgrade-quote")
  @Header("Cache-Control", "no-store")
  async upgradeQuote(
    @CurrentIdentity() actor: Principal,
    @Query() query: UpgradeQuoteQueryDto,
  ) {
    return success(
      await this.subscriptions.upgradeQuote(actor, query.planCode),
    );
  }

  @Post("me/subscription/upgrade")
  @Header("Cache-Control", "no-store")
  @ApiHeader({ name: "Idempotency-Key", required: true })
  async upgrade(
    @CurrentIdentity() actor: Principal,
    @Headers("idempotency-key") key: string | undefined,
    @Body() body: UpgradeSubscriptionDto,
  ) {
    return success(
      await this.subscriptions.upgrade(
        actor,
        { ...body, expectedAmount: parseCredit(body.expectedAmount) },
        key,
      ),
      "Subscription upgraded.",
    );
  }

  @Patch("me/subscription")
  @Header("Cache-Control", "no-store")
  async update(
    @CurrentIdentity() actor: Principal,
    @Body() body: UpdateSubscriptionDto,
  ) {
    return success(await this.subscriptions.update(actor, body));
  }

  @Get("me/subscription/charges")
  @Header("Cache-Control", "no-store")
  async charges(
    @CurrentIdentity() actor: Principal,
    @Query() query: ListPageQuery,
  ) {
    const page = await this.subscriptions.charges(actor, query);
    return paginated(page.data, page.pagination);
  }
}
