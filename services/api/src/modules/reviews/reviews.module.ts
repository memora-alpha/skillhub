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
  controllers: [ReviewsController, PublicReviewsController],
  providers: [ReviewsService, PublicReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
