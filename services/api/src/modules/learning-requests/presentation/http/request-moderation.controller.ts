import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";
import type { Request } from "express";
import {
  CurrentIdentity,
  IdentityGuard,
} from "../../../../shared/auth/identity.guard";
import type { Principal } from "../../../auth/application/services/sessions.service";
import { paginated, success } from "../../../../shared/http/response";
import { getOrCreateRequestContext } from "../../../../shared/http/request-context";
import {
  ApiErrorResponse,
  ApiSuccessResponse,
} from "../../../../shared/http/api-response.decorators";
import { ModerateLearningRequestUseCase } from "../../application/use-cases/moderate-learning-request.use-case";
import { ListLearningRequestsUseCase } from "../../application/use-cases/list-learning-requests.use-case";
import {
  ApproveLearningRequestDto,
  RejectLearningRequestDto,
} from "./request-moderation.dto";
import { LearningRequestModerationResponse } from "./learning-requests.responses";
import { LearningRequestQueryDto } from "./learning-requests.dto";

@ApiTags("learning-request-moderation")
@ApiBearerAuth()
@UseGuards(IdentityGuard)
@ApiErrorResponse(400)
@ApiErrorResponse(401)
@ApiErrorResponse(403)
@ApiErrorResponse(404)
@ApiErrorResponse(409)
@Controller({ path: "staff/learning-requests", version: "1" })
export class RequestModerationController {
  constructor(
    private readonly moderate: ModerateLearningRequestUseCase,
    private readonly listRequests: ListLearningRequestsUseCase,
  ) {}

  @Get("moderation")
  @ApiOperation({ summary: "List pending Learning Requests for moderation" })
  @ApiSuccessResponse(200, LearningRequestModerationResponse, {
    paginated: true,
  })
  async queue(
    @CurrentIdentity() actor: Principal,
    @Query() query: LearningRequestQueryDto,
  ) {
    const page = await this.listRequests.execute(actor, "MODERATION", query);
    return paginated(
      page.items,
      {
        nextCursor: page.nextCursor,
        hasMore: page.nextCursor !== null,
        limit: query.limit ?? 20,
      },
      "Learning requests retrieved.",
    );
  }

  @Post(":requestId/approve")
  @ApiParam({ name: "requestId", format: "uuid" })
  @HttpCode(200)
  @ApiOperation({ summary: "Approve a pending Learning Request" })
  @ApiSuccessResponse(200, LearningRequestModerationResponse)
  async approve(
    @CurrentIdentity() actor: Principal,
    @Param("requestId", ParseUUIDPipe) requestId: string,
    @Body() body: ApproveLearningRequestDto,
    @Req() request: Request,
  ) {
    return success(
      await this.moderate.execute(
        actor,
        requestId,
        "APPROVE",
        body,
        getOrCreateRequestContext(request),
      ),
      "Learning request approved.",
    );
  }

  @Post(":requestId/reject")
  @ApiParam({ name: "requestId", format: "uuid" })
  @HttpCode(200)
  @ApiOperation({ summary: "Reject a pending Learning Request" })
  @ApiSuccessResponse(200, LearningRequestModerationResponse)
  async reject(
    @CurrentIdentity() actor: Principal,
    @Param("requestId", ParseUUIDPipe) requestId: string,
    @Body() body: RejectLearningRequestDto,
    @Req() request: Request,
  ) {
    return success(
      await this.moderate.execute(
        actor,
        requestId,
        "REJECT",
        body,
        getOrCreateRequestContext(request),
      ),
      "Learning request rejected.",
    );
  }
}
