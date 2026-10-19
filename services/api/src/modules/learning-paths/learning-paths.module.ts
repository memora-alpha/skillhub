import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../infrastructure/database/database.module";
import { IdentityModule } from "../identity.module";
import { ConversationsModule } from "../conversations/conversations.module";
import { CreditModule } from "../credit/credit.module";
import { LearningPathsController } from "./learning-paths.controller";
import { LearningPathsService } from "./learning-paths.service";

@Module({
  imports: [DatabaseModule, IdentityModule, ConversationsModule, CreditModule],
  controllers: [LearningPathsController],
  providers: [LearningPathsService],
  exports: [LearningPathsService],
})
export class LearningPathsModule {}
