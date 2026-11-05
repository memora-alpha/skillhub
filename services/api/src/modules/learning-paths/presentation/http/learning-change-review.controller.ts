import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiPropertyOptional, ApiTags } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, IsUUID, Max, Min } from "class-validator";
import {
  CurrentIdentity,
  IdentityGuard,
} from "../../../../shared/auth/identity.guard";
import type { Principal } from "../../../auth/application/services/sessions.service";
import { success } from "../../../../shared/http/response";
import { PathTerminationService } from "../../application/services/path-termination.service";

class ReviewQueueDto {
  @ApiPropertyOptional({ default: 100, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 100;
  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  after?: string;
}
@ApiTags("learning-paths")
@ApiBearerAuth()
@UseGuards(IdentityGuard)
@Controller({ path: "learning-changes", version: "1" })
export class LearningChangeReviewController {
  constructor(private readonly changes: PathTerminationService) {}
  @Get("review-queue")
  async queue(
    @CurrentIdentity() actor: Principal,
    @Query() query: ReviewQueueDto,
  ) {
    return success(await this.changes.queue(actor, query.limit, query.after));
  }
}
