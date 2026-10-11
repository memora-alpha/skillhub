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
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  CurrentIdentity,
  IdentityGuard,
} from "../../shared/auth/identity.guard";
import type { Principal } from "../auth/application/services/sessions.service";
import { success } from "../../shared/http/response";
import { ConfirmSessionCompletionDto } from "./learning-sessions.dto";
import { LearningSessionsService } from "./learning-sessions.service";

@ApiTags("sessions")
@ApiBearerAuth()
@UseGuards(IdentityGuard)
@Controller({ path: "sessions", version: "1" })
export class LearningSessionsController {
  constructor(private readonly sessions: LearningSessionsService) {}

  @Get("mine")
  @ApiOperation({ summary: "List the caller's sessions" })
  async mine(
    @CurrentIdentity() actor: Principal,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return success(
      await this.sessions.mine(actor, from, to),
      "Sessions retrieved.",
    );
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
  @ApiOperation({ summary: "Settle a completed learning path" })
  async settlePath(
    @CurrentIdentity() actor: Principal,
    @Param("pathId", ParseUUIDPipe) pathId: string,
  ) {
    return success(
      await this.sessions.settlePath(actor, pathId),
      "Path settlement processed.",
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
