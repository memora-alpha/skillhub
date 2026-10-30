import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { getQueueToken } from "@nestjs/bullmq";
import { Test } from "@nestjs/testing";
import { VerificationAiModule } from "../../dist/modules/verifications/verification-ai.module.js";
import { VerificationAiService } from "../../dist/modules/verifications/application/services/verification-ai.service.js";
import { VerificationAiProvider } from "../../dist/modules/verifications/application/ports/verification-ai.provider.js";
import { GeminiVerificationAdapter } from "../../dist/modules/verifications/infrastructure/gateway/gemini-verification.adapter.js";
import { DatabaseModule } from "../../dist/infrastructure/database/database.module.js";
import { PrismaService } from "../../dist/infrastructure/database/prisma.service.js";
import { TransactionRunner } from "../../dist/infrastructure/database/transaction-runner.js";
import { StorageModule } from "../../dist/infrastructure/storage/storage.module.js";
import { FileStorageService } from "../../dist/infrastructure/storage/file-storage.service.js";
import { FileAttachmentService } from "../../dist/infrastructure/storage/file-attachment.service.js";
import { QueueModule } from "../../dist/infrastructure/queue/queue.module.js";
import { IdentityModule } from "../../dist/modules/identity.module.js";
import { IdentityGuard } from "../../dist/shared/auth/identity.guard.js";
import { SessionsService } from "../../dist/modules/auth/application/services/sessions.service.js";
import { SkillActorService } from "../../dist/modules/users/application/services/skill-actor.service.js";
import { UsersService } from "../../dist/modules/users/application/services/users.service.js";
import { SharingSkillsModule } from "../../dist/modules/sharing-skills/sharing-skills.module.js";
import { SharingSkillsService } from "../../dist/modules/sharing-skills/application/services/sharing-skills.service.js";
import { OutboxDispatcher } from "../../dist/infrastructure/events/outbox-dispatcher.js";

function fixture(providers) {
  class Fixture {}
  Module({ providers, exports: providers.map((provider) => provider.provide) })(
    Fixture,
  );
  return Fixture;
}

test("production AI module resolves owner contracts, provider, controller and worker without network", async () => {
  const module = await Test.createTestingModule({
    imports: [VerificationAiModule],
  })
    .overrideModule(DatabaseModule)
    .useModule(
      fixture([
        { provide: PrismaService, useValue: {} },
        { provide: TransactionRunner, useValue: {} },
      ]),
    )
    .overrideModule(IdentityModule)
    .useModule(
      fixture([
        { provide: UsersService, useValue: {} },
        { provide: SkillActorService, useValue: {} },
        { provide: IdentityGuard, useValue: {} },
        { provide: SessionsService, useValue: {} },
      ]),
    )
    .overrideModule(StorageModule)
    .useModule(
      fixture([
        { provide: FileStorageService, useValue: {} },
        { provide: FileAttachmentService, useValue: {} },
      ]),
    )
    .overrideModule(SharingSkillsModule)
    .useModule(fixture([{ provide: SharingSkillsService, useValue: {} }]))
    .overrideModule(QueueModule)
    .useModule(fixture([]))
    .overrideProvider(ConfigService)
    .useValue(new ConfigService({ VERIFICATION_AI_ENABLED: "false" }))
    .overrideProvider(getQueueToken("verification-ai"))
    .useValue({ close: async () => {} })
    .overrideProvider(OutboxDispatcher)
    .useValue({})
    .compile();
  try {
    assert.ok(
      module.get(VerificationAiService) instanceof VerificationAiService,
    );
    assert.ok(
      module.get(VerificationAiProvider) instanceof GeminiVerificationAdapter,
    );
  } finally {
    await module.close();
  }
});
