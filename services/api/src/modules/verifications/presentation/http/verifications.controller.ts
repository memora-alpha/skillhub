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
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Readable } from "node:stream";
import {
  ApiTags,
  ApiBearerAuth,
  ApiHeader,
  ApiConsumes,
  ApiBody,
} from "@nestjs/swagger";
import {
  IdentityGuard,
  CurrentIdentity,
  type IdentityRequest,
} from "../../../../shared/auth/identity.guard";
import type { Principal } from "../../../auth/application/services/sessions.service";
import { success, paginated } from "../../../../shared/http/response";
import { getOrCreateRequestContext } from "../../../../shared/http/request-context";
import {
  ApiSuccessResponse,
  ApiErrorResponse,
} from "../../../../shared/http/api-response.decorators";
import { skillCommand } from "../../../skills/presentation/http/skills.controller";
import { PageDto } from "../../../skills/presentation/http/skills.dto";
import { VerificationsService } from "../../application/verifications.service";
import { SubmitEvidenceDto } from "./verifications.dto";
import {
  VerificationResponse,
  FileStatusResponse,
  EvidenceDownloadResponse,
} from "./verifications.responses";
@ApiTags("skill-evidence")
@ApiBearerAuth()
@UseGuards(IdentityGuard)
@ApiErrorResponse(400)
@ApiErrorResponse(401)
@ApiErrorResponse(403)
@ApiErrorResponse(404)
@ApiErrorResponse(409)
@ApiErrorResponse(413)
@ApiErrorResponse(415)
@ApiErrorResponse(503)
@ApiHeader({
  name: "Idempotency-Key",
  required: false,
  description: "Required for submission",
})
@Controller({ path: "me/skills/:sharingSkillId", version: "1" })
export class VerificationsController {
  constructor(private readonly verifications: VerificationsService) {}
  @Post("evidence-files")
  @HttpCode(202)
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      required: ["file"],
      properties: { file: { type: "string", format: "binary" } },
    },
  })
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: 10_000_000, files: 1, fields: 0 },
    }),
  )
  @ApiSuccessResponse(202, FileStatusResponse)
  async upload(
    @Req() req: IdentityRequest,
    @CurrentIdentity() p: Principal,
    @Param("sharingSkillId", ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) throw new BadRequestException("FILE_REQUIRED");
    return success(
      await this.verifications.upload(p, id, {
        name: file.originalname,
        claimedMime: file.mimetype,
        body: Readable.from(file.buffer),
        correlationId: getOrCreateRequestContext(req).correlationId,
      }),
    );
  }
  @Get("evidence-files/:fileId")
  @ApiSuccessResponse(200, FileStatusResponse)
  async fileStatus(
    @CurrentIdentity() p: Principal,
    @Param("sharingSkillId", ParseUUIDPipe) id: string,
    @Param("fileId", ParseUUIDPipe) fileId: string,
  ) {
    return success(await this.verifications.uploadStatus(p, id, fileId));
  }
  @Post("verifications")
  @ApiSuccessResponse(201, VerificationResponse)
  async submit(
    @Req() req: IdentityRequest,
    @CurrentIdentity() p: Principal,
    @Headers("idempotency-key") key: string | undefined,
    @Param("sharingSkillId", ParseUUIDPipe) id: string,
    @Body() body: SubmitEvidenceDto,
  ) {
    return success(
      await this.verifications.submit(skillCommand(req, key, p), id, body),
    );
  }
  @Get("verifications")
  @ApiSuccessResponse(200, VerificationResponse, { paginated: true })
  async history(
    @CurrentIdentity() p: Principal,
    @Param("sharingSkillId", ParseUUIDPipe) id: string,
    @Query() query: PageDto,
  ) {
    const r = await this.verifications.history(p, id, query);
    return paginated(r.data, r.pagination);
  }
  @Get("verifications/:verificationId")
  @ApiSuccessResponse(200, VerificationResponse)
  async get(
    @CurrentIdentity() p: Principal,
    @Param("sharingSkillId", ParseUUIDPipe) id: string,
    @Param("verificationId", ParseUUIDPipe) requestId: string,
  ) {
    return success(await this.verifications.detail(p, requestId, id));
  }
  @Get("evidence/:evidenceId/download")
  @ApiSuccessResponse(200, EvidenceDownloadResponse)
  async download(
    @CurrentIdentity() p: Principal,
    @Param("sharingSkillId", ParseUUIDPipe) id: string,
    @Param("evidenceId", ParseUUIDPipe) evidenceId: string,
  ) {
    return success(
      await this.verifications.download(p, id, undefined, evidenceId),
    );
  }
}
