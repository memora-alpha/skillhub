import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { BullModule } from "@nestjs/bullmq";
import { DatabaseModule } from "../../infrastructure/database/database.module";
import { OutboxModule } from "../../infrastructure/events/outbox.module";
import { IdempotencyModule } from "../../infrastructure/idempotency/idempotency.module";
import { StorageModule } from "../../infrastructure/storage/storage.module";
import { QueueModule } from "../../infrastructure/queue/queue.module";
import { IdentityModule } from "../identity.module";
import { AuditModule } from "../audit/audit.module";
import { SharingSkillsModule } from "../sharing-skills/sharing-skills.module";
import { VerificationAiContext } from "./application/services/verification-ai.context";
import { VerificationAiProvider } from "./application/ports/verification-ai.provider";
import { VerificationAiService } from "./application/services/verification-ai.service";
import { VerificationsRepository } from "./infrastructure/persistence/verifications.repository";
import { VerificationAiRepository } from "./infrastructure/persistence/verification-ai.repository";
import { GeminiVerificationAdapter } from "./infrastructure/gateway/gemini-verification.adapter";
import {
  VerificationAiPublisher,
  VerificationAiWorker,
} from "./infrastructure/jobs/verification-ai.queue";
import {
  AI_QUEUE,
  VERIFICATION_AI_CONFIG,
  verificationAiConfiguration,
  type VerificationAiConfiguration,
} from "./domain/verification-ai.config";
import { VerificationAiController } from "./presentation/http/verification-ai.controller";

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    OutboxModule,
    IdempotencyModule,
    StorageModule,
    QueueModule,
    IdentityModule,
    AuditModule,
    SharingSkillsModule,
    BullModule.registerQueue({ name: AI_QUEUE }),
  ],
  controllers: [VerificationAiController],
  providers: [
    VerificationsRepository,
    VerificationAiRepository,
    VerificationAiContext,
    VerificationAiService,
    VerificationAiPublisher,
    VerificationAiWorker,
    {
      provide: VERIFICATION_AI_CONFIG,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        verificationAiConfiguration(
          Object.fromEntries(
            [
              "VERIFICATION_AI_ENABLED",
              "GEMINI_API_KEY",
              "GEMINI_MODEL",
              "GEMINI_TIMEOUT_MS",
              "GEMINI_MAX_OUTPUT_TOKENS",
              "GEMINI_MAX_INPUT_TOKENS",
              "VERIFICATION_AI_MAX_RUNS",
            ].map((key) => [key, config.get(key)]),
          ),
        ),
    },
    {
      provide: VerificationAiProvider,
      inject: [VERIFICATION_AI_CONFIG],
      useFactory: (config: VerificationAiConfiguration) =>
        new GeminiVerificationAdapter(config),
    },
  ],
  exports: [VerificationAiService],
})
export class VerificationAiModule {}
