import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Readable } from "node:stream";
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import {
  CurrentIdentity,
  IdentityGuard,
  type IdentityRequest,
} from "../../shared/auth/identity.guard";
import type { Principal } from "../auth/application/services/sessions.service";
import { getOrCreateRequestContext } from "../../shared/http/request-context";
import { success } from "../../shared/http/response";
import { CreateSessionReportDto, ReportCaseActionDto } from "./reports.dto";
import { ReportsService } from "./reports.service";

@ApiTags("reports")
@ApiBearerAuth()
@UseGuards(IdentityGuard)
@Controller({ path: "reports", version: "1" })
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Post("evidence-files")
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
  async uploadEvidence(
    @Req() req: IdentityRequest,
    @CurrentIdentity() actor: Principal,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) throw new BadRequestException("FILE_REQUIRED");
    return success(
      await this.reports.upload(actor, {
        name: file.originalname,
        claimedMime: file.mimetype,
        body: Readable.from(file.buffer),
        correlationId: getOrCreateRequestContext(req).correlationId,
      }),
      "Report evidence upload accepted.",
    );
  }

  @Get("evidence-files/:fileId")
  async evidenceStatus(
    @CurrentIdentity() actor: Principal,
    @Param("fileId", ParseUUIDPipe) fileId: string,
  ) {
    return success(await this.reports.fileStatus(actor, fileId));
  }

  @Get("staff/evidence/:evidenceId/download")
  async staffEvidenceDownload(
    @CurrentIdentity() actor: Principal,
    @Param("evidenceId", ParseUUIDPipe) evidenceId: string,
  ) {
    return success(await this.reports.staffEvidenceDownload(actor, evidenceId));
  }

  @Post("sessions/:sessionId")
  @ApiOperation({
    summary: "Report a session with reason and optional evidence",
  })
  async createSessionReport(
    @CurrentIdentity() actor: Principal,
    @Param("sessionId", ParseUUIDPipe) sessionId: string,
    @Body() body: CreateSessionReportDto,
  ) {
    return success(
      await this.reports.createSessionReport(actor, sessionId, body),
      "Session report submitted.",
    );
  }

  @Get("mine")
  async mine(@CurrentIdentity() actor: Principal) {
    return success(await this.reports.listMine(actor));
  }

  @Get("staff/queue")
  async staffQueue(@CurrentIdentity() actor: Principal) {
    return success(await this.reports.staffQueue(actor));
  }

  @Get("staff/:caseId")
  async staffCaseDetail(
    @CurrentIdentity() actor: Principal,
    @Param("caseId", ParseUUIDPipe) caseId: string,
  ) {
    return success(await this.reports.staffCaseDetail(actor, caseId));
  }

  @Post("staff/:caseId/:action")
  async staffAction(
    @CurrentIdentity() actor: Principal,
    @Param("caseId", ParseUUIDPipe) caseId: string,
    @Param("action") action: "claim" | "need-more-info" | "resolve" | "reject",
    @Body() body: ReportCaseActionDto,
  ) {
    if (!["claim", "need-more-info", "resolve", "reject"].includes(action)) {
      throw new BadRequestException("INVALID_REPORT_ACTION");
    }
    return success(
      await this.reports.updateCase(actor, caseId, action, body),
      "Report case updated.",
    );
  }
}
