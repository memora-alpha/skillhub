import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiHeader } from "@nestjs/swagger";
import {
  IdentityGuard,
  CurrentIdentity,
  type IdentityRequest,
} from "../../../../shared/auth/identity.guard";
import type { Principal } from "../../../auth/application/services/sessions.service";
import { success, paginated } from "../../../../shared/http/response";
import {
  ApiSuccessResponse,
  ApiErrorResponse,
} from "../../../../shared/http/api-response.decorators";
import { skillCommand } from "../../../skills/presentation/http/skills.controller";
import { VerificationsService } from "../../application/services/verifications.service";
import {
  ApproveEvidenceDto,
  RejectEvidenceDto,
  RevokeEvidenceDto,
  VerificationQueryDto,
} from "./verifications.dto";
import {
  VerificationResponse,
  EvidenceDownloadResponse,
} from "./verifications.responses";
@ApiTags("staff-verifications")
@ApiBearerAuth()
@UseGuards(IdentityGuard)
@ApiErrorResponse(400)
@ApiErrorResponse(401)
@ApiErrorResponse(403)
@ApiErrorResponse(404)
@ApiErrorResponse(409)
@ApiHeader({
  name: "Idempotency-Key",
  required: false,
  description: "Required for decisions",
})
@Controller({ path: "staff/verifications", version: "1" })
export class StaffVerificationsController {
  constructor(private readonly verifications: VerificationsService) {}
  @Get()
  @ApiSuccessResponse(200, VerificationResponse, { paginated: true })
  async queue(
    @CurrentIdentity() p: Principal,
    @Query() query: VerificationQueryDto,
  ) {
    const r = await this.verifications.queue(p, query);
    return paginated(r.data, r.pagination);
  }
  @Get(":verificationId")
  @ApiSuccessResponse(200, VerificationResponse)
  async get(
    @CurrentIdentity() p: Principal,
    @Param("verificationId", ParseUUIDPipe) id: string,
  ) {
    return success(await this.verifications.detail(p, id));
  }
  @Post(":verificationId/approve")
  @HttpCode(200)
  @ApiSuccessResponse(200, VerificationResponse)
  async approve(
    @Req() req: IdentityRequest,
    @CurrentIdentity() p: Principal,
    @Headers("idempotency-key") key: string | undefined,
    @Param("verificationId", ParseUUIDPipe) id: string,
    @Body() body: ApproveEvidenceDto,
  ) {
    return success(
      await this.verifications.decide(
        skillCommand(req, key, p),
        id,
        body,
        true,
      ),
    );
  }
  @Post(":verificationId/reject")
  @HttpCode(200)
  @ApiSuccessResponse(200, VerificationResponse)
  async reject(
    @Req() req: IdentityRequest,
    @CurrentIdentity() p: Principal,
    @Headers("idempotency-key") key: string | undefined,
    @Param("verificationId", ParseUUIDPipe) id: string,
    @Body() body: RejectEvidenceDto,
  ) {
    return success(
      await this.verifications.decide(
        skillCommand(req, key, p),
        id,
        body,
        false,
      ),
    );
  }
  @Post(":verificationId/evidence/:evidenceId/revoke")
  @HttpCode(200)
  @ApiSuccessResponse(200, VerificationResponse)
  async revoke(
    @Req() req: IdentityRequest,
    @CurrentIdentity() p: Principal,
    @Headers("idempotency-key") key: string | undefined,
    @Param("verificationId", ParseUUIDPipe) id: string,
    @Param("evidenceId", ParseUUIDPipe) evidenceId: string,
    @Body() body: RevokeEvidenceDto,
  ) {
    return success(
      await this.verifications.revoke(
        skillCommand(req, key, p),
        id,
        evidenceId,
        body.reason,
      ),
    );
  }
  @Get(":verificationId/evidence/:evidenceId/download")
  @ApiSuccessResponse(200, EvidenceDownloadResponse)
  async download(
    @CurrentIdentity() p: Principal,
    @Param("verificationId", ParseUUIDPipe) id: string,
    @Param("evidenceId", ParseUUIDPipe) evidenceId: string,
  ) {
    return success(
      await this.verifications.download(p, undefined, id, evidenceId),
    );
  }
}
