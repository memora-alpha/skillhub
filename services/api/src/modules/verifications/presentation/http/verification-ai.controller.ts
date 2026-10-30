import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiExtraModels,
  ApiHeader,
  ApiOperation,
  ApiProperty,
  ApiTags,
} from "@nestjs/swagger";
import { VerificationAiService } from "../../application/services/verification-ai.service";
import {
  IdentityGuard,
  CurrentIdentity,
  type IdentityRequest,
} from "../../../../shared/auth/identity.guard";
import type { Principal } from "../../../auth/application/services/sessions.service";
import { success } from "../../../../shared/http/response";
import {
  ApiErrorResponse,
  ApiSuccessResponse,
} from "../../../../shared/http/api-response.decorators";
import { skillCommand } from "../../../skills/presentation/http/skills.controller";
import { VersionDto } from "../../../skills/presentation/http/skills.dto";
import {
  VerificationAiResultResponse,
  VerificationAiContextResponse,
} from "./verification-ai.responses";

export class VerificationAiRunResponse {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty({ format: "uuid" }) verificationId!: string;
  @ApiProperty({
    enum: [
      "QUEUED",
      "PROCESSING",
      "SUCCEEDED",
      "FAILED",
      "STALE",
      "UNSUPPORTED",
    ],
  })
  status!: string;
  @ApiProperty() model!: string;
  @ApiProperty() promptVersion!: string;
  @ApiProperty({ minimum: 0, maximum: 3 }) attempts!: number;
  @ApiProperty({ type: String, format: "date-time" }) createdAt!: string;
  @ApiProperty({ type: String, format: "date-time", nullable: true })
  completedAt!: string | null;
  @ApiProperty({ type: String, nullable: true }) errorCode!: string | null;
  @ApiProperty({
    type: VerificationAiContextResponse,
    description:
      "Private applicant/skill snapshot used for this run; never public.",
  })
  context!: VerificationAiContextResponse;
  @ApiProperty({
    type: VerificationAiResultResponse,
    nullable: true,
    description:
      "Advisory per-file extraction, match, tamperingAssessment, issuerVerification=UNVERIFIED, citations, batch recommendation and token usage. See verification-ai.md.",
  })
  result!: VerificationAiResultResponse | null;
}
class VerificationAiLatestResponse extends VerificationAiRunResponse {
  @ApiProperty({
    description:
      "Input, model or prompt changed, or the verification is no longer pending.",
  })
  isStale!: boolean;
}
class VerificationAiReadResponse {
  @ApiProperty() enabled!: boolean;
  @ApiProperty({ type: VerificationAiLatestResponse, nullable: true })
  latest!: VerificationAiLatestResponse | null;
}

@ApiTags("staff-verification-ai")
@ApiBearerAuth()
@UseGuards(IdentityGuard)
@ApiExtraModels(VerificationAiRunResponse)
@ApiErrorResponse(400)
@ApiErrorResponse(401)
@ApiErrorResponse(403)
@ApiErrorResponse(404)
@ApiErrorResponse(409)
@ApiErrorResponse(503)
@Controller({ path: "staff/verifications", version: "1" })
export class VerificationAiController {
  constructor(private readonly ai: VerificationAiService) {}

  @Get(":verificationId/ai-analysis")
  @ApiOperation({
    summary:
      "Read latest private advisory AI analysis (permission: skill-verification:read)",
  })
  @ApiSuccessResponse(200, VerificationAiReadResponse)
  async get(
    @CurrentIdentity() principal: Principal,
    @Param("verificationId", ParseUUIDPipe) id: string,
  ) {
    return success(await this.ai.read(principal, id));
  }

  @Post(":verificationId/ai-analysis")
  @HttpCode(202)
  @ApiHeader({ name: "Idempotency-Key", required: true })
  @ApiOperation({
    summary:
      "Request or retry AI analysis (permission: skill-verification:analyze)",
    description:
      "Advisory only. Reuses an active run or successful matching input. New runs are bounded by configuration; unsupported file formats require manual review.",
  })
  @ApiSuccessResponse(202, VerificationAiRunResponse)
  async request(
    @Req() req: IdentityRequest,
    @CurrentIdentity() principal: Principal,
    @Headers("idempotency-key") key: string | undefined,
    @Param("verificationId", ParseUUIDPipe) id: string,
    @Body() body: VersionDto,
  ) {
    return success(
      await this.ai.request(
        skillCommand(req, key, principal),
        id,
        body.expectedVersion,
      ),
    );
  }
}
