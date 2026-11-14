import { Controller, Get, Header, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type { Principal } from "../auth/application/services/sessions.service";
import {
  CurrentIdentity,
  IdentityGuard,
} from "../../shared/auth/identity.guard";
import { ApiErrorResponse } from "../../shared/http/api-response.decorators";
import { success } from "../../shared/http/response";
import { AdminDashboardQuery } from "./admin-dashboard-query.dto";
import { AdminDashboardService } from "./admin-dashboard.service";

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
  @ApiOkResponse({
    description:
      "Snapshot with user growth, learning, fees and operational queue sections.",
  })
  async overview(
    @CurrentIdentity() actor: Principal,
    @Query() query: AdminDashboardQuery,
  ) {
    return success(await this.dashboard.overview(actor, query));
  }

  @Get("learning")
  @Header("Cache-Control", "no-store")
  @ApiOkResponse({
    description:
      "Learning path and session statistics for the selected period.",
  })
  async learning(
    @CurrentIdentity() actor: Principal,
    @Query() query: AdminDashboardQuery,
  ) {
    return success(await this.dashboard.learning(actor, query));
  }

  @Get("finance")
  @Header("Cache-Control", "no-store")
  @ApiOkResponse({
    description: "Recorded Credit fees and VND top-up payment statistics.",
  })
  async finance(
    @CurrentIdentity() actor: Principal,
    @Query() query: AdminDashboardQuery,
  ) {
    return success(await this.dashboard.finance(actor, query));
  }
}
