import { Controller, Get, Header, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Principal } from "../auth/application/services/sessions.service";
import {
  CurrentIdentity,
  IdentityGuard,
} from "../../shared/auth/identity.guard";
import {
  ApiErrorResponse,
  ApiSuccessResponse,
} from "../../shared/http/api-response.decorators";
import { success } from "../../shared/http/response";
import { AdminDashboardQuery } from "./admin-dashboard-query.dto";
import { AdminDashboardService } from "./admin-dashboard.service";
import {
  DashboardFinanceResponse,
  DashboardLearningResponse,
  DashboardOverviewResponse,
} from "./admin-dashboard.responses";

@ApiTags("admin-dashboard")
@ApiBearerAuth()
@ApiErrorResponse(400)
@ApiErrorResponse(401)
@ApiErrorResponse(403)
@UseGuards(IdentityGuard)
@Controller({ path: "admin/dashboard", version: "1" })
export class AdminDashboardController {
  constructor(private readonly dashboard: AdminDashboardService) {}

  @Get("overview")
  @Header("Cache-Control", "no-store")
  @ApiSuccessResponse(200, DashboardOverviewResponse)
  async overview(
    @CurrentIdentity() actor: Principal,
    @Query() query: AdminDashboardQuery,
  ) {
    return success(await this.dashboard.overview(actor, query));
  }

  @Get("learning")
  @Header("Cache-Control", "no-store")
  @ApiSuccessResponse(200, DashboardLearningResponse)
  async learning(
    @CurrentIdentity() actor: Principal,
    @Query() query: AdminDashboardQuery,
  ) {
    return success(await this.dashboard.learning(actor, query));
  }

  @Get("finance")
  @Header("Cache-Control", "no-store")
  @ApiSuccessResponse(200, DashboardFinanceResponse)
  async finance(
    @CurrentIdentity() actor: Principal,
    @Query() query: AdminDashboardQuery,
  ) {
    return success(await this.dashboard.finance(actor, query));
  }
}
