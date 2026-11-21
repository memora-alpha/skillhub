import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ContentModerationService } from "./application/content-moderation.service";
import { OpenAiModerationClient } from "./infrastructure/openai-moderation.client";
import { MediaTextExtractor } from "./infrastructure/media-text-extractor";
import { MediaModerationService } from "./application/media-moderation.service";
import { DatabaseModule } from "../../infrastructure/database/database.module";

@Module({
  imports: [ConfigModule, DatabaseModule],
  providers: [
    ContentModerationService,
    OpenAiModerationClient,
    MediaModerationService,
    MediaTextExtractor,
  ],
  exports: [ContentModerationService, MediaModerationService],
})
export class ContentModerationModule {}
