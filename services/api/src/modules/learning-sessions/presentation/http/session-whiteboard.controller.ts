import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Put,
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
import { SessionWhiteboardService } from "../../application/services/session-whiteboard.service";
import {
  SaveSessionWhiteboardDto,
  SessionWhiteboardResponse,
  SessionWhiteboardSaveResponse,
  StaffSessionWhiteboardResponse,
} from "./session-whiteboard.dto";

@ApiTags("sessions")
@ApiBearerAuth()
@UseGuards(IdentityGuard)
@Controller({ path: "sessions", version: "1" })
export class SessionWhiteboardController {
  constructor(private readonly whiteboards: SessionWhiteboardService) {}

  @Get(":sessionId/whiteboard")
  @Header("Cache-Control", "no-store")
  @ApiOperation({
    summary: "Read the persisted whiteboard scene of a Session",
    description:
      "Participants only. Returns revision 0 and sceneData null before the first save. readOnly follows whiteboard.editWindow: teacher preparation from confirmation, both participants from the join window until the post-session grace period ends.",
  })
  @ApiSuccessResponse(200, SessionWhiteboardResponse)
  @ApiErrorResponse(403)
  @ApiErrorResponse(404)
  async read(
    @CurrentIdentity() actor: Principal,
    @Param("sessionId", ParseUUIDPipe) sessionId: string,
  ) {
    return success(
      await this.whiteboards.read(actor, sessionId),
      "Session whiteboard retrieved.",
    );
  }

  @Get(":sessionId/whiteboard/staff-review")
  @Header("Cache-Control", "no-store")
  @ApiOperation({
    summary: "Staff reads a Session whiteboard for an open report case",
    description:
      "Requires report:moderate, the STAFF or ADMIN role, and being the handler of an OPEN, UNDER_REVIEW or NEED_MORE_INFO case that targets or relates to this Session. Read-only; every read is audited as REPORT_EVIDENCE_READ.",
  })
  @ApiSuccessResponse(200, StaffSessionWhiteboardResponse)
  @ApiErrorResponse(403)
  @ApiErrorResponse(404)
  @ApiErrorResponse(409)
  async staffReview(
    @CurrentIdentity() actor: Principal,
    @Param("sessionId", ParseUUIDPipe) sessionId: string,
    @Query("caseId", ParseUUIDPipe) caseId: string,
  ) {
    return success(
      await this.whiteboards.staffRead(actor, sessionId, caseId),
      "Session whiteboard retrieved for review.",
    );
  }

  @Put(":sessionId/whiteboard")
  @Header("Cache-Control", "no-store")
  @ApiOperation({
    summary: "Replace the whiteboard scene with optimistic locking",
    description:
      "Participants only, inside the caller's edit window. 409 WHITEBOARD_REVISION_CONFLICT includes currentRevision; reload, merge and retry. 409 WHITEBOARD_READ_ONLY includes reason. 413 WHITEBOARD_SCENE_TOO_LARGE above 2 MiB.",
  })
  @ApiSuccessResponse(200, SessionWhiteboardSaveResponse)
  @ApiErrorResponse(400)
  @ApiErrorResponse(403)
  @ApiErrorResponse(404)
  @ApiErrorResponse(409)
  @ApiErrorResponse(413)
  @ApiErrorResponse(503)
  async save(
    @CurrentIdentity() actor: Principal,
    @Param("sessionId", ParseUUIDPipe) sessionId: string,
    @Body() body: SaveSessionWhiteboardDto,
  ) {
    return success(
      await this.whiteboards.save(
        actor,
        sessionId,
        body.expectedRevision,
        body.sceneData,
      ),
      "Session whiteboard saved.",
    );
  }
}
