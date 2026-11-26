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
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  CurrentIdentity,
  IdentityGuard,
} from "../../../../shared/auth/identity.guard";
import { paginated, success } from "../../../../shared/http/response";
import type { Principal } from "../../../auth/application/services/sessions.service";
import { parseCredit } from "../../../credit/domain/money";
import { SubscriptionPlansService } from "../../application/services/subscription-plans.service";
import { SubscriptionsService } from "../../application/services/subscriptions.service";
import {
  AdminPlanQueryDto,
  AdminSubscriptionQueryDto,
  ApprovePlanVersionDto,
  CreatePlanVersionDto,
  RetirePlanVersionDto,
} from "./subscriptions.dto";

@ApiTags("admin-subscriptions")
@ApiBearerAuth()
@UseGuards(IdentityGuard)
@Controller({ path: "admin/subscriptions", version: "1" })
export class AdminSubscriptionsController {
  constructor(
    private readonly plans: SubscriptionPlansService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  @Get("plans")
  async listPlans(
    @CurrentIdentity() actor: Principal,
    @Query() query: AdminPlanQueryDto,
  ) {
    const page = await this.plans.adminList(actor, query);
    return paginated(page.data, page.pagination);
  }

  @Post("plans")
  async createPlan(
    @CurrentIdentity() actor: Principal,
    @Body() body: CreatePlanVersionDto,
  ) {
    return success(
      await this.plans.create(actor, {
        planCode: body.planCode,
        monthPrice: parseCredit(body.monthPrice),
        yearPrice: parseCredit(body.yearPrice),
        entitlements: body.entitlements,
        reason: body.reason,
      }),
      "Plan version drafted.",
    );
  }

  @Post("plans/:planVersionId/approve")
  async approvePlan(
    @CurrentIdentity() actor: Principal,
    @Param("planVersionId", ParseUUIDPipe) id: string,
    @Body() body: ApprovePlanVersionDto,
  ) {
    return success(
      await this.plans.approve(actor, id, {
        effectiveAt: new Date(body.effectiveAt),
        reason: body.reason,
      }),
    );
  }

  @Post("plans/:planVersionId/retire")
  async retirePlan(
    @CurrentIdentity() actor: Principal,
    @Param("planVersionId", ParseUUIDPipe) id: string,
    @Body() body: RetirePlanVersionDto,
  ) {
    return success(await this.plans.retire(actor, id, body));
  }

  @Get()
  async list(
    @CurrentIdentity() actor: Principal,
    @Query() query: AdminSubscriptionQueryDto,
  ) {
    const page = await this.subscriptions.adminList(actor, query);
    return paginated(page.data, page.pagination);
  }

  @Get("users/:userId")
  async user(
    @CurrentIdentity() actor: Principal,
    @Param("userId", ParseUUIDPipe) userId: string,
  ) {
    return success(await this.subscriptions.adminUser(actor, userId));
  }
}
