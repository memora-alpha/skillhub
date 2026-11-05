import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiProperty,
  ApiTags,
} from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsString,
  IsOptional,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from "class-validator";
import {
  CurrentIdentity,
  IdentityGuard,
} from "../../../../shared/auth/identity.guard";
import type { Principal } from "../../../auth/application/services/sessions.service";
import { success } from "../../../../shared/http/response";
import {
  ChangeVersionDto,
  RequestLearningChangeDto,
  RespondLearningChangeDto,
} from "../../../learning-sessions/presentation/http/session-changes.controller";
import { PathTerminationService } from "../../application/services/path-termination.service";

class TerminationAllocationDto {
  @ApiProperty({ format: "uuid" }) @IsUUID() allocationId!: string;
  @ApiProperty({ example: "20.00" })
  @Matches(/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/)
  refund!: string;
  @ApiProperty({ example: "0.00" })
  @Matches(/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/)
  counterpartyPayment!: string;
  @ApiProperty({ example: "0.00" })
  @Matches(/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/)
  platformFee!: string;
}
class TerminationReasonDto extends ChangeVersionDto {
  @ApiProperty({ minLength: 3, maxLength: 1000 })
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  reason!: string;
}
class ExecuteTerminationDto extends TerminationReasonDto {
  @ApiProperty({
    required: false,
    minLength: 3,
    maxLength: 1000,
    description:
      "Legacy context only; the backend calculates compensation from attendance",
  })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  compensationReason?: string;
  @ApiProperty() @Matches(/^[a-f0-9]{64}$/) expectedExecutionDigest!: string;
  @ApiProperty({ maxLength: 200, required: false })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  policyReference?: string;
  @ApiProperty({
    type: [TerminationAllocationDto],
    required: false,
    description:
      "Optional exact quote assertion; amounts cannot override the server formula",
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(2)
  @ValidateNested({ each: true })
  @Type(() => TerminationAllocationDto)
  allocations?: TerminationAllocationDto[];
}

@ApiTags("learning-paths")
@ApiBearerAuth()
@UseGuards(IdentityGuard)
@Controller({
  path: "learning-paths/:pathId/termination-requests",
  version: "1",
})
export class PathTerminationController {
  constructor(private readonly changes: PathTerminationService) {}
  @Get("quote")
  @Header("Cache-Control", "no-store")
  @ApiOperation({
    summary:
      "Preview immutable per-session Credit, refund, payment, fee and blockers",
  })
  async quote(
    @CurrentIdentity() actor: Principal,
    @Param("pathId", ParseUUIDPipe) pathId: string,
  ) {
    return success(await this.changes.quote(actor, pathId));
  }
  @Post()
  @ApiHeader({ name: "Idempotency-Key", required: true })
  @ApiOperation({
    summary:
      "Request agreement-wide termination; obligations stop when the partner or Staff approves",
  })
  async request(
    @CurrentIdentity() actor: Principal,
    @Param("pathId", ParseUUIDPipe) pathId: string,
    @Headers("idempotency-key") key: string,
    @Body() body: RequestLearningChangeDto,
  ) {
    return success(await this.changes.request(actor, pathId, key, body.reason));
  }
  @Get()
  async list(
    @CurrentIdentity() actor: Principal,
    @Param("pathId", ParseUUIDPipe) pathId: string,
  ) {
    return success(await this.changes.list(actor, pathId));
  }
  @Post(":requestId/response")
  async respond(
    @CurrentIdentity() actor: Principal,
    @Param("pathId", ParseUUIDPipe) pathId: string,
    @Param("requestId", ParseUUIDPipe) id: string,
    @Body() body: RespondLearningChangeDto,
  ) {
    return success(await this.changes.respond(actor, pathId, id, body));
  }
  @Post(":requestId/withdraw")
  async withdraw(
    @CurrentIdentity() actor: Principal,
    @Param("pathId", ParseUUIDPipe) pathId: string,
    @Param("requestId", ParseUUIDPipe) id: string,
    @Body() body: ChangeVersionDto,
  ) {
    return success(
      await this.changes.withdraw(actor, pathId, id, body.expectedVersion),
    );
  }
  @Post(":requestId/escalate")
  async escalate(
    @CurrentIdentity() actor: Principal,
    @Param("pathId", ParseUUIDPipe) pathId: string,
    @Param("requestId", ParseUUIDPipe) id: string,
    @Body() body: TerminationReasonDto,
  ) {
    return success(
      await this.changes.escalate(
        actor,
        pathId,
        id,
        body.expectedVersion,
        body.reason,
      ),
    );
  }
  @Get(":requestId/review")
  @Header("Cache-Control", "no-store")
  async review(
    @CurrentIdentity() actor: Principal,
    @Param("pathId", ParseUUIDPipe) pathId: string,
    @Param("requestId", ParseUUIDPipe) id: string,
  ) {
    return success(await this.changes.review(actor, pathId, id));
  }
  @Post(":requestId/reject")
  async reject(
    @CurrentIdentity() actor: Principal,
    @Param("pathId", ParseUUIDPipe) pathId: string,
    @Param("requestId", ParseUUIDPipe) id: string,
    @Body() body: TerminationReasonDto,
  ) {
    return success(
      await this.changes.reject(
        actor,
        pathId,
        id,
        body.expectedVersion,
        body.reason,
      ),
    );
  }
  @Post(":requestId/execute")
  @ApiOperation({
    summary:
      "Staff/Admin approves termination; backend calculates settlement or waits for existing session outcomes",
  })
  async execute(
    @CurrentIdentity() actor: Principal,
    @Param("pathId", ParseUUIDPipe) pathId: string,
    @Param("requestId", ParseUUIDPipe) id: string,
    @Body() body: ExecuteTerminationDto,
  ) {
    return success(await this.changes.execute(actor, pathId, id, body));
  }
}
