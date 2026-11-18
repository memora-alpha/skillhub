import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  ApiErrorResponse,
  ApiSuccessResponse,
} from "../../../../shared/http/api-response.decorators";
import { MaterialModerationHistoryResponse } from "./material-moderation.responses";
import { ListPageQuery } from "../../../../shared/http/list-page";
import {
  CurrentIdentity,
  IdentityGuard,
} from "../../../../shared/auth/identity.guard";
import { paginated, success } from "../../../../shared/http/response";
import type { Principal } from "../../../auth/application/services/sessions.service";
import { MaterialModerationService } from "../../application/services/material-moderation.service";
import {
  MODERATION_ACTIONS,
  type ModerationAction,
} from "../../domain/material.policy";
import { ModerateMaterialDto, StaffMaterialQueryDto } from "./materials.dto";

@ApiTags("material-moderation")
@ApiBearerAuth()
@UseGuards(IdentityGuard)
@Controller({ path: "staff/materials", version: "1" })
export class MaterialModerationController {
  constructor(private readonly moderation: MaterialModerationService) {}

  @Get()
  async queue(
    @CurrentIdentity() actor: Principal,
    @Query() query: StaffMaterialQueryDto,
  ) {
    const result = await this.moderation.queue(actor, query.status, query);
    return paginated(result.data, result.pagination);
  }

  @Get(":materialId/moderation-history")
  @ApiOperation({
    summary:
      "Read chronological material moderation decisions; requires material:moderate",
  })
  @ApiSuccessResponse(200, MaterialModerationHistoryResponse, {
    paginated: true,
  })
  @ApiErrorResponse(400, "INVALID_CURSOR or INVALID_PAGE_LIMIT")
  @ApiErrorResponse(401)
  @ApiErrorResponse(403, "STAFF_ACCESS_REQUIRED")
  @ApiErrorResponse(404, "MATERIAL_NOT_FOUND")
  async history(
    @CurrentIdentity() actor: Principal,
    @Param("materialId", ParseUUIDPipe) id: string,
    @Query() query: ListPageQuery,
  ) {
    const result = await this.moderation.history(actor, id, query);
    return paginated(result.data, result.pagination);
  }

  @Post(":materialId/:action")
  async moderate(
    @CurrentIdentity() actor: Principal,
    @Param("materialId", ParseUUIDPipe) id: string,
    @Param("action") action: string,
    @Body() body: ModerateMaterialDto,
  ) {
    if (!MODERATION_ACTIONS.includes(action as ModerationAction))
      throw new BadRequestException("INVALID_MATERIAL_ACTION");
    return success(
      await this.moderation.moderate(
        actor,
        id,
        action as ModerationAction,
        body,
      ),
      "Material moderated.",
    );
  }
}
