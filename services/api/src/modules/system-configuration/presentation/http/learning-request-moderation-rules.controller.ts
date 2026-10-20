import { Body, Controller, Get, Put, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import {
  CurrentIdentity,
  IdentityGuard,
} from "../../../../shared/auth/identity.guard";
import type { Principal } from "../../../auth/application/services/sessions.service";
import { success } from "../../../../shared/http/response";
import {
  getOrCreateRequestContext,
  type ContextualRequest,
} from "../../../../shared/http/request-context";
import {
  ApiErrorResponse,
  ApiSuccessResponse,
} from "../../../../shared/http/api-response.decorators";
import { LearningRequestModerationRulesUseCase } from "../../application/use-cases/learning-request-moderation-rules.use-case";
import { UpdateLearningRequestModerationRulesDto } from "./learning-request-moderation-rules.dto";
import { LearningRequestModerationRulesResponse } from "./learning-request-moderation-rules.responses";

@ApiTags("learning-request-moderation")
@ApiBearerAuth()
@UseGuards(IdentityGuard)
@ApiErrorResponse(400)
@ApiErrorResponse(401)
@ApiErrorResponse(403)
@ApiErrorResponse(409)
@ApiErrorResponse(503)
@Controller({ path: "admin/learning-requests/moderation-rules", version: "1" })
export class LearningRequestModerationRulesController {
  constructor(private readonly rules: LearningRequestModerationRulesUseCase) {}

  @Get()
  @ApiOperation({
    summary: "Read the versioned Learning Request moderation rules",
  })
  @ApiSuccessResponse(200, LearningRequestModerationRulesResponse)
  async get(@CurrentIdentity() actor: Principal) {
    return success(await this.rules.get(actor), "Moderation rules retrieved.");
  }

  @Put()
  @ApiOperation({
    summary: "Update only the Learning Request moderation rules",
  })
  @ApiSuccessResponse(200, LearningRequestModerationRulesResponse)
  async update(
    @CurrentIdentity() actor: Principal,
    @Body() body: UpdateLearningRequestModerationRulesDto,
    @Req() request: Request,
  ) {
    const context = getOrCreateRequestContext(
      request as Request & ContextualRequest,
    );
    const result = await this.rules.update(actor, { ...body, context });
    return success(result, "Moderation rules updated.");
  }
}
