import { IsISO8601, IsOptional } from "class-validator";
import { ListPageQuery } from "../../../../shared/http/list-page";
import {
  Body,
  BadRequestException,
  Controller,
  Get,
  Header,
  HttpCode,
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
import {
  CurrentIdentity,
  IdentityGuard,
} from "../../../../shared/auth/identity.guard";
import type { Principal } from "../../../auth/application/services/sessions.service";
import { paginated, success } from "../../../../shared/http/response";
import {
  ConfirmSessionCompletionDto,
  SubmitAbsenceExcuseDto,
  DecideAbsenceExcuseDto,
  LiveKitTokenRequestDto,
  ApproveImmediateSettlementDto,
} from "./learning-sessions.dto";
import { LiveKitTokenResponse } from "./learning-sessions.responses";
import { SessionOutcomeService } from "../../application/services/session-outcome.service";
import { LearningSessionsService } from "../../application/services/learning-sessions.service";

class SessionListQuery extends ListPageQuery {
  @IsOptional() @IsISO8601({ strict: true }) from?: string;
  @IsOptional() @IsISO8601({ strict: true }) to?: string;
}
@ApiTags("sessions")
@ApiBearerAuth()
@UseGuards(IdentityGuard)
@Controller({ path: "sessions", version: "1" })
export class LearningSessionsController {
  constructor(
    private readonly sessions: LearningSessionsService,
    private readonly outcomes: SessionOutcomeService,
  ) {}

  @Post(":sessionId/livekit-token")
  @HttpCode(200)
  @Header("Cache-Control", "no-store")
  @ApiOperation({
    summary: "Issue a short-lived LiveKit token for a Session participant",
  })
  @ApiSuccessResponse(200, LiveKitTokenResponse)
  async livekitToken(
    @CurrentIdentity() actor: Principal,
    @Param("sessionId", ParseUUIDPipe) sessionId: string,
    @Body() body: LiveKitTokenRequestDto,
  ) {
    if (Array.isArray(body) || Object.keys(body ?? {}).length)
      throw new BadRequestException("EMPTY_BODY_REQUIRED");
    return success(
      await this.sessions.issueLiveKitToken(actor, sessionId),
      "LiveKit token issued.",
    );
  }

  @Get("mine")
  @ApiOperation({ summary: "List the caller's sessions" })
  async mine(
    @CurrentIdentity() actor: Principal,
    @Query() query: SessionListQuery,
  ) {
    const result = await this.sessions.mine(actor, query.from, query.to, query);
    return paginated(result.data, result.pagination, "Sessions retrieved.");
  }

  @Get(":sessionId")
  @ApiOperation({ summary: "Read a session for one of its participants" })
  async detail(
    @CurrentIdentity() actor: Principal,
    @Param("sessionId", ParseUUIDPipe) sessionId: string,
  ) {
    return success(
      await this.sessions.detail(actor, sessionId),
      "Session retrieved.",
    );
  }

  @Post("paths/:pathId/settlement")
  @ApiOperation({
    summary: "Settle a completed learning path",
    description:
      "Successful full settlement also closes the source Request atomically. Inconsistent legacy source state returns 409 REQUEST_LIFECYCLE_INCONSISTENT; replay does not settle or transition again.",
  })
  @ApiErrorResponse(409)
  async settlePath(
    @CurrentIdentity() actor: Principal,
    @Param("pathId", ParseUUIDPipe) pathId: string,
  ) {
    return success(
      await this.sessions.settlePath(actor, pathId),
      "Path settlement processed.",
    );
  }

  @Post("paths/:pathId/settlement-consent")
  @HttpCode(200)
  @ApiOperation({
    summary:
      "Approve immediate final settlement; both participants must explicitly approve",
    description:
      "Separate from Session completion. Both consents bypass only the 48-hour wait. Blocking reports and termination requests still hold Credit.",
  })
  @ApiErrorResponse(409)
  async approveSettlement(
    @CurrentIdentity() actor: Principal,
    @Param("pathId", ParseUUIDPipe) pathId: string,
    @Body() body: ApproveImmediateSettlementDto,
  ) {
    return success(
      await this.sessions.approveImmediateSettlement(
        actor,
        pathId,
        body.expectedVersion,
      ),
      "Immediate settlement consent recorded.",
    );
  }

  @Post(":sessionId/absence-excuse")
  @ApiOperation({
    summary: "Explain an absence; the present participant decides",
  })
  @ApiErrorResponse(409)
  async submitExcuse(
    @CurrentIdentity() actor: Principal,
    @Param("sessionId", ParseUUIDPipe) sessionId: string,
    @Body() body: SubmitAbsenceExcuseDto,
  ) {
    return success(
      await this.outcomes.submitExcuse(actor, sessionId, body.reason),
      "Absence excuse submitted.",
    );
  }

  @Post(":sessionId/absence-excuse/decision")
  @HttpCode(200)
  @ApiOperation({ summary: "Accept or reject the partner's absence excuse" })
  @ApiErrorResponse(409)
  async decideExcuse(
    @CurrentIdentity() actor: Principal,
    @Param("sessionId", ParseUUIDPipe) sessionId: string,
    @Body() body: DecideAbsenceExcuseDto,
  ) {
    return success(
      await this.outcomes.decideExcuse(
        actor,
        sessionId,
        body.accept,
        body.note,
      ),
      "Absence excuse decided.",
    );
  }

  @Post(":sessionId/confirm-completion")
  @ApiOperation({ summary: "Confirm a completed session" })
  async complete(
    @CurrentIdentity() actor: Principal,
    @Param("sessionId", ParseUUIDPipe) sessionId: string,
    @Body() body: ConfirmSessionCompletionDto,
  ) {
    return success(
      await this.sessions.complete(actor, sessionId, body.note),
      "Session completion recorded.",
    );
  }
}
