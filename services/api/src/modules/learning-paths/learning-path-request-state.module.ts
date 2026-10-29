import { Module } from "@nestjs/common";
import { LearningRequestPathReader } from "./application/services/learning-request-path.reader";

@Module({
  providers: [LearningRequestPathReader],
  exports: [LearningRequestPathReader],
})
export class LearningPathRequestStateModule {}
