import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
  type ApiResponseSchemaHost,
} from "@nestjs/swagger";
import {
  CurrentIdentity,
  IdentityGuard,
  type IdentityRequest,
} from "../../../../shared/auth/identity.guard";
import type { Principal } from "../../../auth/application/services/sessions.service";
import { paginated, success } from "../../../../shared/http/response";
import { skillCommand } from "../../../skills/presentation/http/skills.controller";
import { LearningPathsService } from "../../application/services/learning-paths.service";
import {
  ConfirmVersionDto,
  ChangeLearningPathDto,
  CreateLearningPathDto,
  CreateLearningPlanDto,
  ReviseLearningPlanDto,
} from "./learning-paths.dto";

const conflictWindowSchema = {
  type: "object" as const,
  required: ["planId", "sessionNo", "startAt", "endAt"],
  properties: {
    sessionId: { type: "string" as const, format: "uuid" },
    planId: { type: "string" as const, format: "uuid" },
    sessionNo: { type: "integer" as const, minimum: 1 },
    startAt: { type: "string" as const, format: "date-time" },
    endAt: { type: "string" as const, format: "date-time" },
  },
};

const finalizeConflictSchema: ApiResponseSchemaHost["schema"] = {
  type: "object" as const,
  required: ["success", "message", "statusCode"],
  properties: {
    success: { type: "boolean" as const, enum: [false] },
    message: { type: "string" as const },
    statusCode: { type: "integer" as const, enum: [409] },
    details: {
      oneOf: [
        {
          type: "object" as const,
          required: ["userIds"],
          properties: {
            userIds: {
              type: "array" as const,
              items: { type: "string" as const, format: "uuid" },
            },
          },
        },
        {
          type: "object" as const,
          required: ["conflicts"],
          properties: {
            conflicts: {
              type: "array" as const,
              items: {
                type: "object" as const,
                required: [
                  "type",
                  "affectedUserIds",
                  "proposed",
                  "compared",
                  "overlapStartAt",
                  "overlapEndAt",
                ],
                properties: {
                  type: {
                    type: "string" as const,
                    enum: ["INTERNAL", "SESSION"],
                  },
                  affectedUserIds: {
                    type: "array" as const,
                    items: { type: "string" as const, format: "uuid" },
                  },
                  proposed: conflictWindowSchema,
                  compared: conflictWindowSchema,
                  overlapStartAt: {
                    type: "string" as const,
                    format: "date-time",
                  },
                  overlapEndAt: {
                    type: "string" as const,
                    format: "date-time",
                  },
                },
              },
            },
          },
        },
      ],
    },
  },
};

@ApiTags("learning-paths")
@ApiBearerAuth()
@UseGuards(IdentityGuard)
@Controller({ path: "learning-paths", version: "1" })
export class LearningPathsController {
  constructor(private readonly paths: LearningPathsService) {}

  @Get("mine")
  @ApiOperation({
    summary: "List the caller's LearningPaths, newest creation first",
    description:
      "Ordered by createdAt DESC, id DESC. Continue with meta.pagination.nextCursor.",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    type: Number,
    description: "1–100; default 100",
  })
  @ApiQuery({ name: "cursor", required: false, type: String })
  async mine(
    @CurrentIdentity() actor: Principal,
    @Query("limit") limit?: string,
    @Query("cursor") cursor?: string,
  ) {
    const page = await this.paths.listMinePage(actor, { limit, cursor });
    return paginated(page.data, page.pagination, "Learning paths retrieved.");
  }

  @Get(":pathId")
  @ApiOperation({
    summary:
      "Read the current agreement, plans, schedule proposals and sessions",
  })
  async detail(
    @CurrentIdentity() actor: Principal,
    @Param("pathId", ParseUUIDPipe) pathId: string,
  ) {
    return success(
      await this.paths.detail(actor, pathId),
      "Learning path retrieved.",
    );
  }

  @Post()
  @ApiOperation({ summary: "Create a versioned LearningPath agreement" })
  async create(
    @CurrentIdentity() actor: Principal,
    @Body() body: CreateLearningPathDto,
  ) {
    return success(
      await this.paths.create(actor, body),
      "Learning path created.",
    );
  }

  @Patch(":pathId")
  @ApiOperation({ summary: "Create a new unconfirmed agreement version" })
  async reviseAgreement(
    @CurrentIdentity() actor: Principal,
    @Param("pathId", ParseUUIDPipe) pathId: string,
    @Body() body: ChangeLearningPathDto,
  ) {
    return success(
      await this.paths.reviseAgreement(actor, pathId, body),
      "Learning path revised.",
    );
  }

  @Post(":pathId/final-validation")
  @HttpCode(200)
  @ApiOperation({
    summary: "Validate the complete agreement before lock",
    description:
      "Request sources must still be NEGOTIATING; REQUEST_NOT_AVAILABLE or REQUEST_LIFECYCLE_INCONSISTENT return 409. Validation does not reserve a commitment.",
  })
  @ApiResponse({ status: 409, schema: finalizeConflictSchema })
  async validateForFinalize(
    @CurrentIdentity() actor: Principal,
    @Param("pathId", ParseUUIDPipe) pathId: string,
  ) {
    return success(
      await this.paths.validateForFinalize(actor, pathId),
      "Learning path is ready to finalize.",
    );
  }

  @Post(":pathId/finalize")
  @HttpCode(200)
  @ApiOperation({
    summary: "Atomically Hold Credit, lock schedules and create sessions",
    description:
      "Also marks the source Request MATCHED in the same transaction. Only one Path per Request may finalize. REQUEST_ALREADY_MATCHED, REQUEST_NOT_AVAILABLE or REQUEST_LIFECYCLE_INCONSISTENT return 409; replay of the same consistent Path creates no additional Hold or Session.",
  })
  @ApiResponse({ status: 409, schema: finalizeConflictSchema })
  @ApiHeader({ name: "Idempotency-Key", required: true })
  async finalize(
    @Req() req: IdentityRequest,
    @Headers("idempotency-key") key: string | undefined,
    @CurrentIdentity() actor: Principal,
    @Param("pathId", ParseUUIDPipe) pathId: string,
    @Body() body: ConfirmVersionDto,
  ) {
    return success(
      await this.paths.finalize(
        skillCommand(req, key, actor),
        pathId,
        body.expectedVersion,
      ),
      "Learning path finalized.",
    );
  }

  @Post(":pathId/plans")
  @ApiOperation({ summary: "Create the teacher's plan for a LearningPath" })
  async addPlan(
    @CurrentIdentity() actor: Principal,
    @Param("pathId", ParseUUIDPipe) pathId: string,
    @Body() body: CreateLearningPlanDto,
  ) {
    return success(
      await this.paths.addPlan(actor, pathId, body),
      "Learning plan created.",
    );
  }

  @Post(":pathId/confirm")
  @HttpCode(200)
  @ApiOperation({ summary: "Confirm the common LearningPath version" })
  async confirmAgreement(
    @CurrentIdentity() actor: Principal,
    @Param("pathId", ParseUUIDPipe) pathId: string,
    @Body() body: ConfirmVersionDto,
  ) {
    return success(
      await this.paths.confirmAgreement(actor, pathId, body.expectedVersion),
      "Learning path confirmed.",
    );
  }

  @Post("plans/:planId/confirm")
  @HttpCode(200)
  @ApiOperation({ summary: "Confirm the current LearningPlan version" })
  async confirmPlan(
    @CurrentIdentity() actor: Principal,
    @Param("planId", ParseUUIDPipe) planId: string,
    @Body() body: ConfirmVersionDto,
  ) {
    return success(
      await this.paths.confirmPlan(actor, planId, body.expectedVersion),
      "Learning plan confirmed.",
    );
  }

  @Patch("plans/:planId")
  @ApiOperation({ summary: "Create a new teacher-owned LearningPlan version" })
  async revisePlan(
    @CurrentIdentity() actor: Principal,
    @Param("planId", ParseUUIDPipe) planId: string,
    @Body() body: ReviseLearningPlanDto,
  ) {
    return success(
      await this.paths.revisePlan(actor, planId, body.expectedVersion, body),
      "Learning plan revised.",
    );
  }
}
