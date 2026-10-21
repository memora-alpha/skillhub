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
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  CurrentIdentity,
  IdentityGuard,
} from "../../../../shared/auth/identity.guard";
import { success } from "../../../../shared/http/response";
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
    return success(await this.moderation.queue(actor, query.status));
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
