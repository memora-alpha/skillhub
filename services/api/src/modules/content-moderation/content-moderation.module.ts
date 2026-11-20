import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ContentModerationService } from "./application/content-moderation.service";
import { OpenAiModerationClient } from "./infrastructure/openai-moderation.client";

@Module({
  imports: [ConfigModule],
  providers: [ContentModerationService, OpenAiModerationClient],
  exports: [ContentModerationService],
})
export class ContentModerationModule {}
