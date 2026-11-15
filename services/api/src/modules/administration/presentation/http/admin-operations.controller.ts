import {
  BadRequestException,
  Controller,
  ForbiddenException,
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
import { paginated, success } from "../../../../shared/http/response";
import type { Principal } from "../../../auth/application/services/sessions.service";
import { AdminDashboardReader } from "../../application/services/admin-dashboard.reader";
import { AdminLearningPathsReader } from "../../application/services/admin-learning-paths.reader";
import { AdminWorkItemsReader } from "../../application/services/admin-work-items.reader";
import {
  AdminLearningPathQueryDto,
  AdminTrendQueryDto,
  AdminWindowQueryDto,
  AdminWorkItemQueryDto,
  WORK_ITEM_KINDS,
} from "./admin-operations.dto";

@ApiTags("admin-operations")
@ApiBearerAuth()
@UseGuards(IdentityGuard)
@Controller({ path: "admin", version: "1" })
export class AdminOperationsController {
  constructor(
    private readonly dashboard: AdminDashboardReader,
    private readonly work: AdminWorkItemsReader,
    private readonly paths: AdminLearningPathsReader,
  ) {}

  @Get("dashboard/summary")
  @ApiOperation({ summary: "Read the authoritative administrative dashboard" })
  async summary(
    @CurrentIdentity() principal: Principal,
    @Query() query: AdminWindowQueryDto,
  ) {
    requirePermission(principal, "dashboard:read");
    return success(await this.dashboard.summary(query));
  }

  @Get("dashboard/trends")
  @ApiOperation({ summary: "Read local-day administrative dashboard trends" })
  async trends(
    @CurrentIdentity() principal: Principal,
    @Query() query: AdminTrendQueryDto,
  ) {
    requirePermission(principal, "dashboard:read");
    return success(await this.dashboard.trends(query));
  }

  @Get("dashboard/work-items")
  @ApiOperation({
    summary: "List normalized authoritative administrative work",
  })
  async workItems(
    @CurrentIdentity() principal: Principal,
    @Query() query: AdminWorkItemQueryDto,
  ) {
    requirePermission(principal, "dashboard:read");
    const result = await this.work.list(query);
    return paginated(result.data, result.pagination);
  }

  @Get("dashboard/work-items/:kind/:id")
  @ApiOperation({
    summary: "Read and audit one safe administrative work projection",
  })
  async workItem(
    @CurrentIdentity() principal: Principal,
    @Param("kind") kind: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    requirePermission(principal, "dashboard:read");
    if (!WORK_ITEM_KINDS.includes(kind as (typeof WORK_ITEM_KINDS)[number]))
      throw new BadRequestException("ADMIN_WORK_KIND_UNSUPPORTED");
    return success(
      await this.work.detail(
        principal,
        kind as (typeof WORK_ITEM_KINDS)[number],
        id,
      ),
    );
  }

  @Get("learning-paths")
  @ApiOperation({
    summary: "List safe administrative learning path projections",
  })
  async learningPaths(
    @CurrentIdentity() principal: Principal,
    @Query() query: AdminLearningPathQueryDto,
  ) {
    requirePermission(principal, "learning-path:read:admin");
    const result = await this.paths.list(query);
    return paginated(result.data, result.pagination);
  }

  @Get("learning-paths/:pathId")
  @ApiOperation({
    summary: "Read and audit one safe administrative learning path",
  })
  async learningPath(
    @CurrentIdentity() principal: Principal,
    @Param("pathId", ParseUUIDPipe) pathId: string,
  ) {
    requirePermission(principal, "learning-path:read:admin");
    return success(await this.paths.detail(principal, pathId));
  }
}

function requirePermission(principal: Principal, permission: string) {
  if (
    !principal.roles.includes("ADMIN") ||
    !principal.permissions.includes(permission)
  )
    throw new ForbiddenException("ADMIN_ACCESS_REQUIRED");
}
