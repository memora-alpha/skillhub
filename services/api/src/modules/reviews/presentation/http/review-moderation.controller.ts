import {
  ApiSuccessResponse,
  ApiErrorResponse,
} from "../../../../shared/http/api-response.decorators";
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
import { ApiBearerAuth, ApiProperty, ApiTags } from "@nestjs/swagger";
import { IsBoolean, IsInt, Min } from "class-validator";
import {
  CurrentIdentity,
  IdentityGuard,
} from "../../../../shared/auth/identity.guard";
import type { Principal } from "../../../auth/application/services/sessions.service";
import { success, paginated } from "../../../../shared/http/response";
import { ListPageQuery } from "../../../../shared/http/list-page";
import { ReasonDto } from "../../../users/presentation/http/users.dto";
import { ReviewModerationService } from "../../application/services/review-moderation.service";
export class ReviewModerationDto extends ReasonDto {
  @ApiProperty() @IsBoolean() hidden!: boolean;
  @ApiProperty({ minimum: 0 }) @IsInt() @Min(0) expectedVersion!: number;
}
export class ReviewModerationResult {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty({ type: String, nullable: true, format: "date-time" })
  hiddenAt!: string | null;
  @ApiProperty() version!: number;
}
export class ModeratedReviewItem {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty({ format: "uuid" }) pathId!: string;
  @ApiProperty({ format: "uuid" }) reviewerId!: string;
  @ApiProperty({ format: "uuid" }) revieweeId!: string;
  @ApiProperty() rating!: number;
  @ApiProperty({ type: String, nullable: true }) comment!: string | null;
  @ApiProperty({ format: "date-time" }) createdAt!: string;
  @ApiProperty({ type: String, nullable: true, format: "date-time" })
  hiddenAt!: string | null;
  @ApiProperty() moderationVersion!: number;
}
@ApiTags("review-moderation")
@ApiBearerAuth()
@UseGuards(IdentityGuard)
@ApiErrorResponse(400)
@ApiErrorResponse(401)
@ApiErrorResponse(403)
@ApiErrorResponse(404)
@ApiErrorResponse(409)
@Controller({ path: "staff/reviews", version: "1" })
export class ReviewModerationController {
  constructor(private readonly reviews: ReviewModerationService) {}
  @Get()
  @ApiSuccessResponse(200, ModeratedReviewItem, { paginated: true })
  async list(
    @CurrentIdentity() actor: Principal,
    @Query() query: ListPageQuery,
  ) {
    const page = await this.reviews.list(actor, query);
    return paginated(page.data, page.pagination);
  }
  @Post(":id/moderation")
  @ApiSuccessResponse(201, ReviewModerationResult)
  async change(
    @CurrentIdentity() actor: Principal,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: ReviewModerationDto,
  ) {
    return success(await this.reviews.change(actor, id, input));
  }
}
