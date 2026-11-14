import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import type { Response } from "express";
import {
  CurrentIdentity,
  IdentityGuard,
} from "../../../../shared/auth/identity.guard";
import { success } from "../../../../shared/http/response";
import type { Principal } from "../../../auth/application/services/sessions.service";
import { MaterialReviewsService } from "../../application/services/material-reviews.service";
import {
  CreateMaterialReviewDto,
  DeleteMaterialReviewQueryDto,
  MaterialReviewQueryDto,
  ReportMaterialReviewDto,
  UpdateMaterialReviewDto,
} from "./materials.dto";

@ApiTags("material-reviews")
@Controller({ version: "1" })
export class PublicMaterialReviewsController {
  constructor(private readonly reviews: MaterialReviewsService) {}

  @Get("materials/:materialId/reviews")
  @ApiOperation({ summary: "List visible material reviews and rating summary" })
  @ApiResponse({
    status: 200,
    description: "Cursor page with a visible-only rating summary.",
    content: {
      "application/json": {
        example: {
          data: [
            {
              id: "5f3df64e-8a0d-49df-9303-6ece008695e0",
              rating: 5,
              comment: "Clear and useful.",
              verifiedPurchase: true,
              version: 1,
            },
          ],
          meta: {
            pagination: { nextCursor: null, hasMore: false },
            ratingSummary: {
              average: "5.00",
              total: 1,
              distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 1 },
            },
          },
        },
      },
    },
  })
  async list(
    @Param("materialId", ParseUUIDPipe) materialId: string,
    @Query() query: MaterialReviewQueryDto,
  ) {
    const result = await this.reviews.list(materialId, query);
    return success(result.data, undefined, {
      pagination: result.pagination,
      ratingSummary: result.summary,
    });
  }
}

@ApiTags("material-reviews")
@ApiBearerAuth()
@UseGuards(IdentityGuard)
@Controller({ version: "1" })
export class MaterialReviewsController {
  constructor(private readonly reviews: MaterialReviewsService) {}

  @Get("materials/:materialId/review-eligibility")
  @ApiOperation({ summary: "Get the caller's live review eligibility" })
  @ApiResponse({
    status: 200,
    description:
      "Eligibility uses stable reason codes and includes any current review.",
    content: {
      "application/json": {
        example: {
          data: {
            canReview: false,
            reasonCode: "ALREADY_REVIEWED",
            currentReview: { id: "5f3df64e-8a0d-49df-9303-6ece008695e0" },
          },
        },
      },
    },
  })
  async eligibility(
    @CurrentIdentity() actor: Principal,
    @Param("materialId", ParseUUIDPipe) materialId: string,
  ) {
    return success(await this.reviews.eligibility(actor, materialId));
  }

  @Post("materials/:materialId/reviews")
  @ApiHeader({ name: "Idempotency-Key", required: true })
  @ApiOperation({ summary: "Create one idempotent material review" })
  @ApiResponse({ status: 201, description: "Review created." })
  @ApiResponse({ status: 200, description: "Idempotent replay." })
  @ApiResponse({
    status: 409,
    description: "Not eligible; error details include a stable reason code.",
  })
  async create(
    @CurrentIdentity() actor: Principal,
    @Param("materialId", ParseUUIDPipe) materialId: string,
    @Headers("idempotency-key") key: string | undefined,
    @Body() body: CreateMaterialReviewDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.reviews.create(actor, materialId, body, key);
    response.status(result.replayed ? 200 : 201);
    return success(result.review, "Material review saved.");
  }

  @Patch("material-reviews/:reviewId")
  @ApiOperation({
    summary: "Update an owned visible review by expected version",
  })
  @ApiResponse({
    status: 409,
    description: "Version conflict or hidden review.",
  })
  async update(
    @CurrentIdentity() actor: Principal,
    @Param("reviewId", ParseUUIDPipe) reviewId: string,
    @Body() body: UpdateMaterialReviewDto,
  ) {
    return success(await this.reviews.update(actor, reviewId, body));
  }

  @Delete("material-reviews/:reviewId")
  @ApiOperation({
    summary: "Soft-delete an owned review; retries are idempotent",
  })
  @ApiResponse({ status: 409, description: "Expected-version conflict." })
  async remove(
    @CurrentIdentity() actor: Principal,
    @Param("reviewId", ParseUUIDPipe) reviewId: string,
    @Query() query: DeleteMaterialReviewQueryDto,
  ) {
    return success(
      await this.reviews.remove(actor, reviewId, query.expectedVersion),
    );
  }

  @Post("material-reviews/:reviewId/reports")
  @ApiOperation({ summary: "Report a visible material review" })
  @ApiResponse({ status: 409, description: "An open report already exists." })
  async report(
    @CurrentIdentity() actor: Principal,
    @Param("reviewId", ParseUUIDPipe) reviewId: string,
    @Body() body: ReportMaterialReviewDto,
  ) {
    return success(
      await this.reviews.report(actor, reviewId, body),
      "Material review reported.",
    );
  }
}
