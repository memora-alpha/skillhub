import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiPropertyOptional,
  ApiTags,
} from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import {
  CurrentIdentity,
  IdentityGuard,
} from "../../../../shared/auth/identity.guard";
import type { Principal } from "../../../auth/application/services/sessions.service";
import { success } from "../../../../shared/http/response";
import { PublicReviewsService } from "../../application/services/public-reviews.service";

export class ReviewPageQuery {
  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1024)
  cursor?: string;
}
export class OwnReviewQuery extends ReviewPageQuery {
  @ApiPropertyOptional({ enum: ["received", "sent"], default: "received" })
  @IsOptional()
  @IsIn(["received", "sent"])
  direction?: "received" | "sent";
}
@ApiTags("reviews")
@ApiBearerAuth()
@UseGuards(IdentityGuard)
@Controller({ version: "1" })
export class PublicReviewsController {
  constructor(private readonly reviews: PublicReviewsService) {}
  @Get("profiles/:userId/reviews")
  @ApiOperation({
    summary:
      "Read public received reviews and rating summary; never exposes private paths",
  })
  async received(
    @Param("userId", ParseUUIDPipe) id: string,
    @Query() query: ReviewPageQuery,
  ) {
    const result = await this.reviews.page(id, query);
    return success({ items: result.data, summary: result.summary }, undefined, {
      pagination: result.pagination,
    });
  }
  @Get("me/reviews")
  @ApiOperation({ summary: "Read own sent or received reviews" })
  async mine(
    @CurrentIdentity() actor: Principal,
    @Query() query: OwnReviewQuery,
  ) {
    const result = await this.reviews.page(
      actor.userId,
      query,
      query.direction ?? "received",
    );
    return success({ items: result.data, summary: result.summary }, undefined, {
      pagination: result.pagination,
    });
  }
}
