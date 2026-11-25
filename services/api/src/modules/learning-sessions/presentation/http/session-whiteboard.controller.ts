import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Put,
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
      "Participants only. Returns revision 0 and sceneData null before the first save. readOnly follows the room join window.",
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

  @Put(":sessionId/whiteboard")
  @Header("Cache-Control", "no-store")
  @ApiOperation({
    summary: "Replace the whiteboard scene with optimistic locking",
    description:
      "Participants only, inside the room join window. 409 WHITEBOARD_REVISION_CONFLICT includes currentRevision; reload, merge and retry. 409 WHITEBOARD_READ_ONLY includes reason. 413 WHITEBOARD_SCENE_TOO_LARGE above 2 MiB.",
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
