import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiHeader, ApiTags } from "@nestjs/swagger";
import {
  CurrentIdentity,
  IdentityGuard,
  type IdentityRequest,
} from "../../../../shared/auth/identity.guard";
import type { Principal } from "../../../auth/application/services/sessions.service";
import { getOrCreateRequestContext } from "../../../../shared/http/request-context";
import { success } from "../../../../shared/http/response";
import {
  ApiErrorResponse,
  ApiSuccessResponse,
} from "../../../../shared/http/api-response.decorators";
import { SkillLevelsService } from "../../application/services/skill-levels.service";
import { skillCommand } from "./skills.controller";
import {
  CreateSkillLevelDto,
  UpdateSkillLevelDto,
  SkillLevelResponse,
} from "./skill-levels.dto";

@ApiTags("skill-levels")
@ApiErrorResponse(404)
@ApiErrorResponse(400)
@Controller({ path: "skills/:skillId/levels", version: "1" })
export class SkillLevelsController {
  constructor(private readonly levels: SkillLevelsService) {}

  @Get()
  @ApiSuccessResponse(200, SkillLevelResponse, { isArray: true })
  async list(@Param("skillId", ParseUUIDPipe) skillId: string) {
    return success(await this.levels.list(skillId));
  }
}

@ApiTags("skill-levels")
@ApiBearerAuth()
@UseGuards(IdentityGuard)
@ApiErrorResponse(400)
@ApiErrorResponse(401)
@ApiErrorResponse(403)
@ApiErrorResponse(404)
@ApiErrorResponse(409)
@ApiHeader({
  name: "Idempotency-Key",
  required: false,
  description: "Required for mutations",
})
@Controller({ path: "admin/skills/:skillId/levels", version: "1" })
export class AdminSkillLevelsController {
  constructor(private readonly levels: SkillLevelsService) {}

  @Get()
  @ApiSuccessResponse(200, SkillLevelResponse, { isArray: true })
  async list(
    @Param("skillId", ParseUUIDPipe) skillId: string,
    @CurrentIdentity() principal: Principal,
    @Req() req: IdentityRequest,
  ) {
    return success(
      await this.levels.list(skillId, {
        principal,
        key: "read",
        context: getOrCreateRequestContext(req),
      }),
    );
  }

  @Post()
  @ApiSuccessResponse(201, SkillLevelResponse)
  async create(
    @Param("skillId", ParseUUIDPipe) skillId: string,
    @CurrentIdentity() principal: Principal,
    @Req() req: IdentityRequest,
    @Headers("idempotency-key") key: string | undefined,
    @Body() body: CreateSkillLevelDto,
  ) {
    return success(
      await this.levels.create(
        skillCommand(req, key, principal),
        skillId,
        body,
      ),
    );
  }

  @Patch(":levelId")
  @ApiSuccessResponse(200, SkillLevelResponse)
  async update(
    @Param("skillId", ParseUUIDPipe) skillId: string,
    @Param("levelId", ParseUUIDPipe) levelId: string,
    @CurrentIdentity() principal: Principal,
    @Req() req: IdentityRequest,
    @Headers("idempotency-key") key: string | undefined,
    @Body() body: UpdateSkillLevelDto,
  ) {
    return success(
      await this.levels.update(
        skillCommand(req, key, principal),
        skillId,
        levelId,
        body,
      ),
    );
  }
}
