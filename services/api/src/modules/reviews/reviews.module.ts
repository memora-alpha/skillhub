import { ReviewModerationController } from "./presentation/http/review-moderation.controller";
import { ReviewModerationService } from "./application/services/review-moderation.service";
import { Module } from "@nestjs/common";
import { PublicReviewsService } from "./application/services/public-reviews.service";
import { PublicReviewsController } from "./presentation/http/public-reviews.controller";
import { DatabaseModule } from "../../infrastructure/database/database.module";
import { IdentityModule } from "../identity.module";
import { ReputationModule } from "../reputation/reputation.module";
import { ReviewsController } from "./presentation/http/reviews.controller";
import { ReviewsService } from "./application/services/reviews.service";

@Module({
  imports: [DatabaseModule, IdentityModule, ReputationModule],
  controllers: [
    ReviewsController,
    PublicReviewsController,
    ReviewModerationController,
  ],
  providers: [ReviewsService, PublicReviewsService, ReviewModerationService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
