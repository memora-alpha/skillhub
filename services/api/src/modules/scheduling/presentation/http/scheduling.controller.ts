import {
  Body,
  Controller,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  CurrentIdentity,
  IdentityGuard,
} from "../../../../shared/auth/identity.guard";
import type { Principal } from "../../../auth/application/services/sessions.service";
import { success } from "../../../../shared/http/response";
import {
  ConfirmScheduleDto,
  CreateScheduleProposalDto,
  RescheduleSessionDto,
} from "./scheduling.dto";
import { SchedulingService } from "../../application/services/scheduling.service";

@ApiTags("scheduling")
@ApiBearerAuth()
@UseGuards(IdentityGuard)
@Controller({ version: "1" })
export class SchedulingController {
  constructor(private readonly scheduling: SchedulingService) {}

  @Post("learning-plans/:planId/schedule-proposals")
  @ApiOperation({
    summary: "Propose schedule items for a confirmed LearningPlan",
  })
  async create(
    @CurrentIdentity() actor: Principal,
    @Param("planId", ParseUUIDPipe) planId: string,
    @Body() body: CreateScheduleProposalDto,
  ) {
    return success(
      await this.scheduling.createProposal(actor, planId, body),
      "Schedule proposal created.",
    );
  }

  @Post("schedule-proposals/:scheduleId/confirm")
  @HttpCode(200)
  @ApiOperation({ summary: "Confirm the current schedule version" })
  async confirm(
    @CurrentIdentity() actor: Principal,
    @Param("scheduleId", ParseUUIDPipe) scheduleId: string,
    @Body() body: ConfirmScheduleDto,
  ) {
    return success(
      await this.scheduling.confirmProposal(
        actor,
        scheduleId,
        body.expectedVersion,
      ),
      "Schedule proposal confirmed.",
    );
  }

  @Post("sessions/:sessionId/reschedule-proposals")
  @ApiOperation({
    summary: "Propose a bilateral reschedule at least 60 minutes before start",
  })
  async reschedule(
    @CurrentIdentity() actor: Principal,
    @Param("sessionId", ParseUUIDPipe) sessionId: string,
    @Body() body: RescheduleSessionDto,
  ) {
    return success(
      await this.scheduling.proposeReschedule(actor, sessionId, body),
      "Reschedule proposal created.",
    );
  }
}
