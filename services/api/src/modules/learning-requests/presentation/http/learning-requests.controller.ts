import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  CurrentIdentity,
  IdentityGuard,
} from "../../../../shared/auth/identity.guard";
import type { Principal } from "../../../auth/application/services/sessions.service";
import { paginated, success } from "../../../../shared/http/response";
import {
  ApiErrorResponse,
  ApiSuccessResponse,
} from "../../../../shared/http/api-response.decorators";
import { CreateLearningRequestUseCase } from "../../application/use-cases/create-learning-request.use-case";
import { PublishLearningRequestUseCase } from "../../application/use-cases/publish-learning-request.use-case";
import { CancelLearningRequestUseCase } from "../../application/use-cases/cancel-learning-request.use-case";
import { EditLearningRequestUseCase } from "../../application/use-cases/edit-learning-request.use-case";
import { ListLearningRequestsUseCase } from "../../application/use-cases/list-learning-requests.use-case";
import { GetLearningRequestUseCase } from "../../application/use-cases/get-learning-request.use-case";
import {
  CancelLearningRequestDto,
  CreateLearningRequestDto,
  EditLearningRequestDto,
  LearningRequestQueryDto,
  PublishLearningRequestDto,
} from "./learning-requests.dto";
import {
  LearningRequestDetailResponse,
  LearningRequestModerationResponse,
  LearningRequestOwnerResponse,
  LearningRequestRecommendationResponse,
  LearningRequestSummaryResponse,
} from "./learning-requests.responses";

@ApiTags("learning-requests")
@ApiBearerAuth()
@UseGuards(IdentityGuard)
@ApiErrorResponse(400)
@ApiErrorResponse(401)
@ApiErrorResponse(403)
@ApiErrorResponse(404)
@ApiErrorResponse(409)
@ApiErrorResponse(503)
@Controller({ path: "learning-requests", version: "1" })
export class LearningRequestsController {
  constructor(
    private readonly createRequest: CreateLearningRequestUseCase,
    private readonly publishRequest: PublishLearningRequestUseCase,
    private readonly cancelRequest: CancelLearningRequestUseCase,
    private readonly editRequest: EditLearningRequestUseCase,
    private readonly listRequests: ListLearningRequestsUseCase,
    private readonly getRequest: GetLearningRequestUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: "List open Learning Requests" })
  @ApiSuccessResponse(200, LearningRequestSummaryResponse, { paginated: true })
  async feed(
    @CurrentIdentity() actor: Principal,
    @Query() query: LearningRequestQueryDto,
  ) {
    return this.listPage(actor, "FEED", query);
  }

  @Get("mine")
  @ApiOperation({ summary: "List the authenticated user's Learning Requests" })
  @ApiSuccessResponse(200, LearningRequestOwnerResponse, { paginated: true })
  async mine(
    @CurrentIdentity() actor: Principal,
    @Query() query: LearningRequestQueryDto,
  ) {
    return this.listPage(actor, "MINE", query);
  }

  @Get("recommended")
  @ApiOperation({ summary: "List Learning Requests matching shared skills" })
  @ApiSuccessResponse(200, LearningRequestRecommendationResponse, {
    paginated: true,
  })
  async recommended(
    @CurrentIdentity() actor: Principal,
    @Query() query: LearningRequestQueryDto,
  ) {
    return this.listPage(actor, "RECOMMENDED", query);
  }

  @Get(":requestId")
  @ApiOperation({
    summary: "Read a Learning Request within the caller's scope",
  })
  @ApiSuccessResponse(200, [
    LearningRequestDetailResponse,
    LearningRequestOwnerResponse,
    LearningRequestModerationResponse,
  ])
  async get(
    @CurrentIdentity() actor: Principal,
    @Param("requestId", ParseUUIDPipe) requestId: string,
  ) {
    return success(
      await this.getRequest.execute(actor, requestId),
      "Learning request retrieved.",
    );
  }

  @Post()
  @ApiOperation({ summary: "Create a Learning Request draft" })
  @ApiSuccessResponse(201, LearningRequestOwnerResponse)
  async create(
    @CurrentIdentity() actor: Principal,
    @Body() body: CreateLearningRequestDto,
  ) {
    return success(
      await this.createRequest.execute(actor, body),
      "Learning request draft created.",
    );
  }

  @Post(":requestId/publish")
  @HttpCode(200)
  @ApiOperation({ summary: "Publish after versioned moderation filtering" })
  @ApiSuccessResponse(200, LearningRequestOwnerResponse)
  async publish(
    @CurrentIdentity() actor: Principal,
    @Param("requestId", ParseUUIDPipe) requestId: string,
    @Body() body: PublishLearningRequestDto,
  ) {
    return success(
      await this.publishRequest.execute(actor, requestId, body),
      "Learning request published.",
    );
  }

  @Post(":requestId/cancel")
  @HttpCode(200)
  @ApiOperation({
    summary: "Cancel an owned Learning Request before Schedule lock",
  })
  @ApiSuccessResponse(200, LearningRequestOwnerResponse)
  async cancel(
    @CurrentIdentity() actor: Principal,
    @Param("requestId", ParseUUIDPipe) requestId: string,
    @Body() body: CancelLearningRequestDto,
  ) {
    return success(
      await this.cancelRequest.execute(actor, requestId, body),
      "Learning request cancelled.",
    );
  }

  @Patch(":requestId")
  @ApiOperation({
    summary: "Edit an owned Learning Request before Negotiating",
  })
  @ApiSuccessResponse(200, LearningRequestOwnerResponse)
  async edit(
    @CurrentIdentity() actor: Principal,
    @Param("requestId", ParseUUIDPipe) requestId: string,
    @Body() body: EditLearningRequestDto,
  ) {
    return success(
      await this.editRequest.execute(actor, requestId, body),
      "Learning request updated.",
    );
  }

  private async listPage(
    actor: Principal,
    scope: "FEED" | "MINE" | "RECOMMENDED",
    query: LearningRequestQueryDto,
  ) {
    const page = await this.listRequests.execute(actor, scope, query);
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
}
