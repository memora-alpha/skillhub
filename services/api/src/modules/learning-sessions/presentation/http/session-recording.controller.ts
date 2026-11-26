import {
  Controller,
  Delete,
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
import { success } from "../../../../shared/http/response";
import type { Principal } from "../../../auth/application/services/sessions.service";
import { SessionRecordingService } from "../../application/services/session-recording.service";
import {
  SessionRecordingListResponse,
  SessionRecordingPlaybackResponse,
  SessionRecordingResponse,
  StaffSessionRecordingPlaybackResponse,
} from "./session-recording.dto";

const ANSWER =
  "Only the participant who did not request. 409 RECORDING_STATE_CONFLICT includes the current status; an unanswered request expires after 2 minutes.";

@ApiTags("sessions")
@ApiBearerAuth()
@UseGuards(IdentityGuard)
@Controller({ path: "sessions", version: "1" })
export class SessionRecordingController {
  constructor(private readonly recordings: SessionRecordingService) {}

  @Get(":sessionId/recordings")
  @Header("Cache-Control", "no-store")
  @ApiOperation({
    summary: "List the recordings of a Session",
    description: "Participants only, newest first. Never includes file URLs.",
  })
  @ApiSuccessResponse(200, SessionRecordingListResponse)
  @ApiErrorResponse(403)
  @ApiErrorResponse(404)
  async list(
    @CurrentIdentity() actor: Principal,
    @Param("sessionId", ParseUUIDPipe) sessionId: string,
  ) {
    return success(
      await this.recordings.list(actor, sessionId),
      "Session recordings retrieved.",
    );
  }

  @Get(":sessionId/recordings/:recordingId/playback")
  @Header("Cache-Control", "no-store")
  @ApiOperation({
    summary: "Get a short-lived URL to watch a recording",
    description:
      "Participants only, READY recordings until they expire (an open report keeps them watchable). The URL lives 5 minutes and is served inline; clients offer no download.",
  })
  @ApiSuccessResponse(200, SessionRecordingPlaybackResponse)
  @ApiErrorResponse(403)
  @ApiErrorResponse(404)
  @ApiErrorResponse(409)
  @ApiErrorResponse(503)
  async playback(
    @CurrentIdentity() actor: Principal,
    @Param("sessionId", ParseUUIDPipe) sessionId: string,
    @Param("recordingId", ParseUUIDPipe) recordingId: string,
  ) {
    return success(
      await this.recordings.playback(actor, sessionId, recordingId),
      "Recording playback URL issued.",
    );
  }

  @Get(":sessionId/recordings/:recordingId/staff-review")
  @Header("Cache-Control", "no-store")
  @ApiOperation({
    summary: "Staff watches a Session recording for an open report case",
    description:
      "Requires report:moderate, the STAFF or ADMIN role, and being the handler of an OPEN, UNDER_REVIEW or NEED_MORE_INFO case that targets or relates to this Session. READY recordings only; read-only. Every URL issued is audited as REPORT_EVIDENCE_READ.",
  })
  @ApiSuccessResponse(200, StaffSessionRecordingPlaybackResponse)
  @ApiErrorResponse(403)
  @ApiErrorResponse(404)
  @ApiErrorResponse(409)
  @ApiErrorResponse(503)
  async staffReview(
    @CurrentIdentity() actor: Principal,
    @Param("sessionId", ParseUUIDPipe) sessionId: string,
    @Param("recordingId", ParseUUIDPipe) recordingId: string,
    @Query("caseId", ParseUUIDPipe) caseId: string,
  ) {
    return success(
      await this.recordings.staffReview(actor, sessionId, recordingId, caseId),
      "Recording playback URL issued for review.",
    );
  }

  @Delete(":sessionId/recordings/:recordingId")
  @Header("Cache-Control", "no-store")
  @ApiOperation({
    summary: "Delete a recording for both participants",
    description:
      "Either participant, READY recordings only. Cannot be undone; the other participant is notified. 409 RECORDING_HELD_BY_REPORT while an open report targets or relates to the Session. Idempotent once deleted.",
  })
  @ApiSuccessResponse(200, SessionRecordingResponse)
  @ApiErrorResponse(403)
  @ApiErrorResponse(404)
  @ApiErrorResponse(409)
  async remove(
    @CurrentIdentity() actor: Principal,
    @Param("sessionId", ParseUUIDPipe) sessionId: string,
    @Param("recordingId", ParseUUIDPipe) recordingId: string,
  ) {
    return success(
      await this.recordings.remove(actor, sessionId, recordingId),
      "Recording deleted.",
    );
  }

  @Post(":sessionId/recordings")
  @Header("Cache-Control", "no-store")
  @ApiOperation({
    summary: "Ask the other participant to record the Session",
    description:
      "Participants only, while the room is open and the Session is READY or ONGOING. Recording starts only after the other participant accepts. The purpose is learning review first, evidence if a report is opened.",
  })
  @ApiSuccessResponse(201, SessionRecordingResponse)
  @ApiErrorResponse(403)
  @ApiErrorResponse(404)
  @ApiErrorResponse(409)
  @ApiErrorResponse(503)
  async request(
    @CurrentIdentity() actor: Principal,
    @Param("sessionId", ParseUUIDPipe) sessionId: string,
  ) {
    return success(
      await this.recordings.request(actor, sessionId),
      "Recording requested.",
    );
  }

  @Post(":sessionId/recordings/:recordingId/accept")
  @HttpCode(200)
  @Header("Cache-Control", "no-store")
  @ApiOperation({
    summary: "Accept a recording request and start recording",
    description: ANSWER,
  })
  @ApiSuccessResponse(200, SessionRecordingResponse)
  @ApiErrorResponse(403)
  @ApiErrorResponse(404)
  @ApiErrorResponse(409)
  @ApiErrorResponse(503)
  async accept(
    @CurrentIdentity() actor: Principal,
    @Param("sessionId", ParseUUIDPipe) sessionId: string,
    @Param("recordingId", ParseUUIDPipe) recordingId: string,
  ) {
    return success(
      await this.recordings.accept(actor, sessionId, recordingId),
      "Recording accepted.",
    );
  }

  @Post(":sessionId/recordings/:recordingId/decline")
  @HttpCode(200)
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Decline a recording request", description: ANSWER })
  @ApiSuccessResponse(200, SessionRecordingResponse)
  @ApiErrorResponse(403)
  @ApiErrorResponse(404)
  @ApiErrorResponse(409)
  async decline(
    @CurrentIdentity() actor: Principal,
    @Param("sessionId", ParseUUIDPipe) sessionId: string,
    @Param("recordingId", ParseUUIDPipe) recordingId: string,
  ) {
    return success(
      await this.recordings.decline(actor, sessionId, recordingId),
      "Recording declined.",
    );
  }

  @Post(":sessionId/recordings/:recordingId/stop")
  @HttpCode(200)
  @Header("Cache-Control", "no-store")
  @ApiOperation({
    summary: "Stop a recording",
    description:
      "Either participant. Idempotent once the recording is stopping or finished. Recording again needs a new request and acceptance.",
  })
  @ApiSuccessResponse(200, SessionRecordingResponse)
  @ApiErrorResponse(403)
  @ApiErrorResponse(404)
  @ApiErrorResponse(409)
  async stop(
    @CurrentIdentity() actor: Principal,
    @Param("sessionId", ParseUUIDPipe) sessionId: string,
    @Param("recordingId", ParseUUIDPipe) recordingId: string,
  ) {
    return success(
      await this.recordings.stop(actor, sessionId, recordingId),
      "Recording stopping.",
    );
  }
}
