import "reflect-metadata";
import { test } from "node:test";
import assert from "node:assert/strict";
import { Module } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { createSkillFixture } from "./helpers.mjs";
import { SkillsModule } from "../../dist/modules/skills/skills.module.js";
import { SharingSkillsModule } from "../../dist/modules/sharing-skills/sharing-skills.module.js";
import { VerificationsModule } from "../../dist/modules/verifications/verifications.module.js";
import { SkillNotificationModule } from "../../dist/modules/notifications/skill-notification.module.js";
import { IdentityModule } from "../../dist/modules/identity.module.js";
import { DatabaseModule } from "../../dist/infrastructure/database/database.module.js";
import { StorageModule } from "../../dist/infrastructure/storage/storage.module.js";
import { PrismaService } from "../../dist/infrastructure/database/prisma.service.js";
import { TransactionRunner } from "../../dist/infrastructure/database/transaction-runner.js";
import { OutboxDispatcher } from "../../dist/infrastructure/events/outbox-dispatcher.js";
import { OutboxPublisherRegistry } from "../../dist/infrastructure/events/outbox.types.js";
import { SessionsService } from "../../dist/modules/auth/application/services/sessions.service.js";
import { SkillActorService } from "../../dist/modules/users/application/services/skill-actor.service.js";
import { ProfileReader } from "../../dist/modules/users/application/services/profile-reader.service.js";
import { PublicSkillReader } from "../../dist/modules/users/application/services/public-skill-reader.js";
import { IdentityGuard } from "../../dist/shared/auth/identity.guard.js";
import { FileAttachmentService } from "../../dist/infrastructure/storage/file-attachment.service.js";
import { FileStorageService } from "../../dist/infrastructure/storage/file-storage.service.js";
import { SkillsService } from "../../dist/modules/skills/application/services/skills.service.js";
import { SharingSkillsService } from "../../dist/modules/sharing-skills/application/services/sharing-skills.service.js";
import { VerificationsService } from "../../dist/modules/verifications/application/services/verifications.service.js";

function fixtureModule(providers) {
  class FixtureModule {}
  Module({ providers, exports: providers.map((row) => row.provide) })(
    FixtureModule,
  );
  return FixtureModule;
}
test(
  "production feature modules resolve dependencies and register their owner ports/publishers",
  { timeout: 120000 },
  async () => {
    const f = await createSkillFixture();
    let module;
    try {
      const publicReader = new PublicSkillReader();
      module = await Test.createTestingModule({
        imports: [
          SkillsModule,
          SharingSkillsModule,
          VerificationsModule,
          SkillNotificationModule,
        ],
      })
        .overrideModule(DatabaseModule)
        .useModule(
          fixtureModule([
            { provide: PrismaService, useValue: f.db },
            { provide: TransactionRunner, useValue: f.transactions },
          ]),
        )
        .overrideModule(IdentityModule)
        .useModule(
          fixtureModule([
            { provide: SessionsService, useValue: f.identity.sessions },
            { provide: SkillActorService, useValue: f.actors },
            { provide: ProfileReader, useValue: f.profiles },
            { provide: PublicSkillReader, useValue: publicReader },
            {
              provide: IdentityGuard,
              useValue: new IdentityGuard(f.identity.sessions),
            },
          ]),
        )
        .overrideModule(StorageModule)
        .useModule(
          fixtureModule([
            { provide: FileStorageService, useValue: f.storage },
            { provide: FileAttachmentService, useValue: f.attachments },
          ]),
        )
        .overrideProvider(OutboxDispatcher)
        .useValue({})
        .compile();
      await module.init();
      assert.ok(module.get(SkillsService) instanceof SkillsService);
      assert.ok(
        module.get(SharingSkillsService) instanceof SharingSkillsService,
      );
      assert.ok(
        module.get(VerificationsService) instanceof VerificationsService,
      );
      assert.ok(
        module.get(OutboxPublisherRegistry).get("skill.verification.decided"),
      );
      assert.ok(
        module.get(OutboxPublisherRegistry).get("skill.evidence.revoked"),
      );
      const owner = await f.account();
      assert.deepEqual((await publicReader.read(owner.user.id)).data, []);
    } finally {
      await module?.close();
      await f.dispose();
    }
  },
);
