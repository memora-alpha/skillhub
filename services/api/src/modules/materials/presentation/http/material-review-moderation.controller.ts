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
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import {
  CurrentIdentity,
  IdentityGuard,
} from "../../../../shared/auth/identity.guard";
import { paginated, success } from "../../../../shared/http/response";
import type { Principal } from "../../../auth/application/services/sessions.service";
import { MaterialReviewModerationService } from "../../application/services/material-review-moderation.service";
import {
  ModerateMaterialReviewDto,
  StaffMaterialReviewQueryDto,
} from "./materials.dto";

@ApiTags("material-review-moderation")
@ApiBearerAuth()
@UseGuards(IdentityGuard)
@Controller({ path: "staff/material-reviews", version: "1" })
export class MaterialReviewModerationController {
  constructor(private readonly moderation: MaterialReviewModerationService) {}

  @Get()
  @ApiOperation({ summary: "List reported or hidden material reviews" })
  @ApiResponse({
    status: 403,
    description: "Requires material-review:moderate.",
  })
  async queue(
    @CurrentIdentity() actor: Principal,
    @Query() query: StaffMaterialReviewQueryDto,
  ) {
    const result = await this.moderation.queue(actor, query.status, query);
    return paginated(result.data, result.pagination);
  }

  @Post(":reviewId/hide")
  @ApiOperation({ summary: "Hide a review and resolve its open reports" })
  @ApiResponse({ status: 409, description: "Expected-version conflict." })
  async hide(
    @CurrentIdentity() actor: Principal,
    @Param("reviewId", ParseUUIDPipe) reviewId: string,
    @Body() body: ModerateMaterialReviewDto,
  ) {
    return success(
      await this.moderation.moderate(actor, reviewId, "hide", body),
    );
  }

  @Post(":reviewId/restore")
  @ApiOperation({
    summary: "Restore a hidden review without reopening old reports",
  })
  @ApiResponse({ status: 409, description: "Expected-version conflict." })
  async restore(
    @CurrentIdentity() actor: Principal,
    @Param("reviewId", ParseUUIDPipe) reviewId: string,
    @Body() body: ModerateMaterialReviewDto,
  ) {
    return success(
      await this.moderation.moderate(actor, reviewId, "restore", body),
    );
  }

  @Post(":reviewId/dismiss-reports")
  @ApiOperation({
    summary: "Reject open reports while keeping a visible review unchanged",
  })
  @ApiResponse({ status: 409, description: "No open report or stale review." })
  async dismissReports(
    @CurrentIdentity() actor: Principal,
    @Param("reviewId", ParseUUIDPipe) reviewId: string,
    @Body() body: ModerateMaterialReviewDto,
  ) {
    return success(
      await this.moderation.dismissReports(actor, reviewId, body),
      "Material review reports dismissed.",
    );
  }
}
