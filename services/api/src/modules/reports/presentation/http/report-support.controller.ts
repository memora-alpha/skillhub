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
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { Type } from "class-transformer";
import {
  CurrentIdentity,
  IdentityGuard,
} from "../../../../shared/auth/identity.guard";
import type { Principal } from "../../../auth/application/services/sessions.service";
import { paginated, success } from "../../../../shared/http/response";
import { ReportSupportService } from "../../application/services/report-support.service";
import { CaseMessagesService } from "../../application/services/case-messages.service";
import { REPORT_SEVERITIES } from "../../domain/report-support.policy";
class IncidentDto {
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsUUID("4", { each: true })
  caseIds!: string[];
  @IsIn(REPORT_SEVERITIES) severity!: string;
  @IsString() @MinLength(3) @MaxLength(2000) reason!: string;
}
class ClassifyDto {
  @IsIn(REPORT_SEVERITIES) severity!: string;
  @IsString() @MinLength(3) @MaxLength(2000) reason!: string;
  @IsInt() @Min(1) expectedVersion!: number;
}
class IncidentDecisionDto {
  @IsIn(["resolve", "reject"]) action!: "resolve" | "reject";
  @IsInt() @Min(1) expectedVersion!: number;
  @IsString() @MinLength(3) @MaxLength(2000) note!: string;
  @IsOptional() @IsIn(["UPHOLD", "EXCUSE", "COMPLETE"]) noShowRuling?:
    "UPHOLD" | "EXCUSE" | "COMPLETE";
  @IsOptional() @IsUUID("4") makeupUserId?: string;
}
class MessageDto {
  @IsUUID("4") clientMessageId!: string;
  @IsString() @MinLength(1) @MaxLength(4000) text!: string;
}
class EvidenceDto {
  @IsUUID("4") fileId!: string;
}
class MessageQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
  @IsOptional() @IsString() @MaxLength(1024) cursor?: string;
}
class QueueQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
  @IsOptional() @IsString() @MaxLength(1024) cursor?: string;
  @IsOptional() @IsIn(REPORT_SEVERITIES) severity?: string;
  @IsOptional()
  @IsIn(["OPEN", "UNDER_REVIEW", "NEED_MORE_INFO", "RESOLVED", "REJECTED"])
  status?: string;
  @IsOptional() @IsUUID("4") handlerId?: string;
}
@ApiTags("report-support")
@ApiBearerAuth()
@UseGuards(IdentityGuard)
@Controller({ path: "reports/support", version: "1" })
export class ReportSupportController {
  constructor(
    private readonly support: ReportSupportService,
    private readonly messages: CaseMessagesService,
  ) {}
  @Post("cases/:id/parties/:partyId/evidence")
  @ApiOperation({
    summary:
      "Party attaches a scanned report file privately; upload using reports/evidence-files first",
  })
  async attachEvidence(
    @CurrentIdentity() actor: Principal,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("partyId", ParseUUIDPipe) partyId: string,
    @Body() input: EvidenceDto,
  ) {
    return success(
      await this.messages.attachEvidence(actor, id, partyId, input.fileId),
    );
  }
  @Get("cases/:id/parties/:partyId/evidence")
  async evidence(
    @CurrentIdentity() actor: Principal,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("partyId", ParseUUIDPipe) partyId: string,
  ) {
    return success(await this.messages.evidence(actor, id, partyId));
  }
  @Get("cases/:id/parties/:partyId/evidence/:evidenceId/download")
  async evidenceDownload(
    @CurrentIdentity() actor: Principal,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("partyId", ParseUUIDPipe) partyId: string,
    @Param("evidenceId", ParseUUIDPipe) evidenceId: string,
  ) {
    return success(
      await this.messages.downloadEvidence(actor, id, partyId, evidenceId),
    );
  }
  @Get("queue")
  @ApiOperation({
    summary: "Paginated report queue filtered by severity, state and handler",
  })
  async queue(@CurrentIdentity() actor: Principal, @Query() query: QueueQuery) {
    const result = await this.support.queue(actor, query);
    return paginated(result.data, result.pagination);
  }
  @Get("incidents/:id")
  @ApiOperation({
    summary: "Read confirmed incident and member report versions",
  })
  async incident(
    @CurrentIdentity() actor: Principal,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return success(await this.support.incident(actor, id));
  }
  @Post("incidents/:id/severity")
  @ApiOperation({ summary: "Classify an incident and its reports together" })
  async classifyIncident(
    @CurrentIdentity() actor: Principal,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: ClassifyDto,
  ) {
    return success(await this.support.classifyIncident(actor, id, input));
  }
  @Post("incidents")
  @ApiOperation({
    summary: "Staff confirms reports refer to the same incident",
  })
  async group(@CurrentIdentity() actor: Principal, @Body() input: IncidentDto) {
    return success(await this.support.createIncident(actor, input));
  }
  @Post("incidents/:id/decision")
  @ApiOperation({
    summary: "Atomic group decision; no duplicated financial/violation effects",
  })
  async decide(
    @CurrentIdentity() actor: Principal,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: IncidentDecisionDto,
  ) {
    return success(await this.support.decide(actor, id, input));
  }
  @Post("cases/:id/severity")
  @ApiOperation({ summary: "Classify a case with version check" })
  async classify(
    @CurrentIdentity() actor: Principal,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: ClassifyDto,
  ) {
    return success(await this.support.classify(actor, id, input));
  }
  @Get("cases/:id/parties/:partyId/messages")
  @ApiOperation({
    summary: "Read a private party/assigned-handler case thread",
  })
  async list(
    @CurrentIdentity() actor: Principal,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("partyId", ParseUUIDPipe) partyId: string,
    @Query() query: MessageQuery,
  ) {
    const result = await this.messages.list(
      actor,
      id,
      partyId,
      query.cursor,
      query.limit,
    );
    return paginated(result.data, result.pagination);
  }
  @Post("cases/:id/parties/:partyId/messages")
  @ApiOperation({
    summary:
      "Send an idempotent private case message; participant replies reopen handler review",
  })
  async send(
    @CurrentIdentity() actor: Principal,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("partyId", ParseUUIDPipe) partyId: string,
    @Body() input: MessageDto,
  ) {
    return success(await this.messages.send(actor, id, partyId, input));
  }
}
