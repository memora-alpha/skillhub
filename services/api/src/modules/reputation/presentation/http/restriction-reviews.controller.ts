import {
  Body,
  Controller,
  Get,
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

class ReputationDecisionReasonDto {
  @IsString()
  @MaxLength(1000)
  reason!: string;
}

class RestrictionReviewDto extends ReputationDecisionReasonDto {
  @IsIn(RESTRICTION_REVIEW_DECISIONS)
  decision!: RestrictionReviewDecision;
}

@ApiTags("reputation")
@ApiBearerAuth()
@UseGuards(IdentityGuard)
@Controller({ path: "reputation", version: "1" })
export class RestrictionReviewsController {
  constructor(
    private readonly transactions: TransactionRunner,
    private readonly reputation: ReputationService,
  ) {}

  @Post("restrictions/policy-acknowledgement")
  @ApiOperation({
    summary: "Acknowledge the reputation policy for the current account",
  })
  async acknowledgePolicy(@CurrentIdentity() actor: Principal) {
    const result = await this.transactions.run((tx) =>
      this.reputation.acknowledgePolicy(tx, actor.userId),
    );
    return success(result, "Policy acknowledged.");
  }

  @Get("users/:userId/restriction-reviews")
  @ApiOperation({ summary: "List outstanding restriction reviews for a user" })
  async pending(
    @CurrentIdentity() actor: Principal,
    @Param("userId", ParseUUIDPipe) userId: string,
  ) {
    const result = await this.transactions.run((tx) =>
      this.reputation.pendingRestrictionReviews(tx, actor, userId),
    );
    return success(result, "Pending restriction reviews retrieved.");
  }

  @Post("restrictions/:restrictionId/review")
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

  @Post("events/:historyId/reverse")
  @ApiOperation({
    summary: "Reverse a confirmed penalty or a fraudulent mission reward",
  })
  async reverse(
    @CurrentIdentity() actor: Principal,
    @Param("historyId", ParseUUIDPipe) historyId: string,
    @Body() body: ReputationDecisionReasonDto,
  ) {
    const result = await this.transactions.run((tx) =>
      this.reputation.reverseEvent(tx, actor, historyId, body.reason),
    );
    return success(result, "Reputation event reversed.");
  }
}
