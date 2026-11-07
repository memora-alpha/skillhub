import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { IsIn, IsString, MaxLength } from "class-validator";
import { TransactionRunner } from "../../../../infrastructure/database/transaction-runner";
import {
  CurrentIdentity,
  IdentityGuard,
} from "../../../../shared/auth/identity.guard";
import { success } from "../../../../shared/http/response";
import type { Principal } from "../../../auth/application/services/sessions.service";
import {
  RESTRICTION_REVIEW_DECISIONS,
  ReputationService,
  type RestrictionReviewDecision,
} from "../../application/services/reputation.service";

class RestrictionReviewDto {
  @IsIn(RESTRICTION_REVIEW_DECISIONS)
  decision!: RestrictionReviewDecision;

  @IsString()
  @MaxLength(1000)
  reason!: string;
}

@ApiTags("reputation")
@ApiBearerAuth()
@UseGuards(IdentityGuard)
@Controller({ path: "reputation/restrictions", version: "1" })
export class RestrictionReviewsController {
  constructor(
    private readonly transactions: TransactionRunner,
    private readonly reputation: ReputationService,
  ) {}

  @Post(":restrictionId/review")
  @ApiOperation({
    summary: "Record a Staff or Admin restriction review decision",
  })
  async review(
    @CurrentIdentity() actor: Principal,
    @Param("restrictionId", ParseUUIDPipe) restrictionId: string,
    @Body() body: RestrictionReviewDto,
  ) {
    const result = await this.transactions.run((tx) =>
      this.reputation.reviewRestriction(
        tx,
        actor,
        restrictionId,
        body.decision,
        body.reason,
      ),
    );
    return success(result, "Restriction review recorded.");
  }
}
