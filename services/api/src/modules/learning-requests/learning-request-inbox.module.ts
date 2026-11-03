import { Module } from "@nestjs/common";
import { LearningRequestInboxReader } from "./application/services/learning-request-inbox.reader";

// Lightweight read contract avoids importing the Request command/worker graph.
@Module({
  providers: [LearningRequestInboxReader],
  exports: [LearningRequestInboxReader],
})
export class LearningRequestInboxModule {}
