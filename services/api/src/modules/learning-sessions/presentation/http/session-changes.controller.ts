import {
  Body,
  Controller,
  Get,
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
  ApiPropertyOptional,
  ApiTags,
} from "@nestjs/swagger";
import {
  IsBoolean,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import {
  CurrentIdentity,
  IdentityGuard,
} from "../../../../shared/auth/identity.guard";
import type { Principal } from "../../../auth/application/services/sessions.service";
import { success } from "../../../../shared/http/response";
import { SessionChangesService } from "../../application/services/session-changes.service";

export class ChangeVersionDto {
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1) expectedVersion!: number;
}
export class RequestLearningChangeDto {
  @ApiProperty({ minLength: 3, maxLength: 1000 })
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  reason!: string;
}
export class RequestSessionCancellationDto extends RequestLearningChangeDto {
  @ApiProperty({ format: "date-time" })
  @IsISO8601({ strict: true })
  @Matches(/(?:Z|[+-]\d{2}:\d{2})$/)
  expectedStartAt!: string;
}
export class RespondLearningChangeDto extends ChangeVersionDto {
  @ApiProperty() @IsBoolean() accept!: boolean;
  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

@ApiTags("sessions")
@ApiBearerAuth()
@UseGuards(IdentityGuard)
@Controller({ path: "sessions/:sessionId/cancellation-requests", version: "1" })
export class SessionChangesController {
  constructor(private readonly changes: SessionChangesService) {}
  @Post()
  @ApiHeader({ name: "Idempotency-Key", required: true })
  @ApiOperation({
    summary:
      "Request bilateral cancellation for makeup; does not reduce promised sessions or charge Credit",
  })
  async request(
    @CurrentIdentity() actor: Principal,
    @Param("sessionId", ParseUUIDPipe) id: string,
    @Headers("idempotency-key") key: string,
    @Body() body: RequestSessionCancellationDto,
  ) {
    return success(await this.changes.request(actor, id, key, body));
  }
  @Get()
  async list(
    @CurrentIdentity() actor: Principal,
    @Param("sessionId", ParseUUIDPipe) id: string,
  ) {
    return success(await this.changes.list(actor, id));
  }
  @Post(":requestId/response")
  async respond(
    @CurrentIdentity() actor: Principal,
    @Param("sessionId", ParseUUIDPipe) id: string,
    @Param("requestId", ParseUUIDPipe) requestId: string,
    @Body() body: RespondLearningChangeDto,
  ) {
    return success(await this.changes.respond(actor, id, requestId, body));
  }
  @Post(":requestId/withdraw")
  async withdraw(
    @CurrentIdentity() actor: Principal,
    @Param("sessionId", ParseUUIDPipe) id: string,
    @Param("requestId", ParseUUIDPipe) requestId: string,
    @Body() body: ChangeVersionDto,
  ) {
    return success(
      await this.changes.withdraw(actor, id, requestId, body.expectedVersion),
    );
  }
}
