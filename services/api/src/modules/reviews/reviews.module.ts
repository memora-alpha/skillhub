import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../infrastructure/database/database.module";
import { IdentityModule } from "../identity.module";
import { ReputationModule } from "../reputation/reputation.module";
import { ReviewsController } from "./presentation/http/reviews.controller";
import { ReviewsService } from "./application/services/reviews.service";

@Module({
  imports: [DatabaseModule, IdentityModule, ReputationModule],
  controllers: [ReviewsController],
  providers: [ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
