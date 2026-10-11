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
  CurrentIdentity,
  IdentityGuard,
} from "../../shared/auth/identity.guard";
import type { Principal } from "../auth/application/services/sessions.service";
import { success } from "../../shared/http/response";
import { CreateReviewDto } from "./reviews.dto";
import { ReviewsService } from "./reviews.service";

@ApiTags("reviews")
@ApiBearerAuth()
@UseGuards(IdentityGuard)
@Controller({ version: "1" })
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Post("learning-paths/:pathId/reviews")
  @ApiOperation({ summary: "Review the other participant after settlement" })
  async create(
    @CurrentIdentity() actor: Principal,
    @Param("pathId", ParseUUIDPipe) pathId: string,
    @Body() body: CreateReviewDto,
  ) {
    return success(
      await this.reviews.create(actor, pathId, body),
      "Review submitted.",
    );
  }

  @Get("learning-paths/:pathId/reviews")
  @ApiOperation({ summary: "List visible reviews for a LearningPath" })
  async list(
    @CurrentIdentity() actor: Principal,
    @Param("pathId", ParseUUIDPipe) pathId: string,
  ) {
    return success(
      await this.reviews.listForPath(actor, pathId),
      "Reviews retrieved.",
    );
  }

  @Get("reputation/me")
  @ApiOperation({ summary: "Read reputation score and history" })
  async history(
    @CurrentIdentity() actor: Principal,
    @Query("cursor") cursor?: string,
  ) {
    return success(
      await this.reviews.history(actor, cursor),
      "Reputation retrieved.",
    );
  }
}
