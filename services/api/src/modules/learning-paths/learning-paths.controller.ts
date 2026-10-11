import {
  Body,
  Controller,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  CurrentIdentity,
  IdentityGuard,
} from "../../shared/auth/identity.guard";
import type { Principal } from "../auth/application/services/sessions.service";
import { success } from "../../shared/http/response";
import { LearningPathsService } from "./learning-paths.service";
import {
  ConfirmVersionDto,
  ChangeLearningPathDto,
  CreateLearningPathDto,
  CreateLearningPlanDto,
  ReviseLearningPlanDto,
} from "./learning-paths.dto";

@ApiTags("learning-paths")
@ApiBearerAuth()
@UseGuards(IdentityGuard)
@Controller({ path: "learning-paths", version: "1" })
export class LearningPathsController {
  constructor(private readonly paths: LearningPathsService) {}

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
  @ApiOperation({ summary: "Validate the complete agreement before lock" })
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
  })
  async finalize(
    @CurrentIdentity() actor: Principal,
    @Param("pathId", ParseUUIDPipe) pathId: string,
    @Body() body: ConfirmVersionDto,
  ) {
    return success(
      await this.paths.finalize(actor, pathId, body.expectedVersion),
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
