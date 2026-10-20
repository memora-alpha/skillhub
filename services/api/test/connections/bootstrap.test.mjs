import "reflect-metadata";
import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { Module, ValidationPipe, VersioningType } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { getConnectionToken } from "@nestjs/mongoose";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { ProposalsModule } from "../../dist/modules/proposals/proposals.module.js";
import { ProposalsService } from "../../dist/modules/proposals/application/services/proposals.service.js";
import { ConversationsService } from "../../dist/modules/conversations/application/services/conversations.service.js";
import { DatabaseModule } from "../../dist/infrastructure/database/database.module.js";
import { PrismaService } from "../../dist/infrastructure/database/prisma.service.js";
import { TransactionRunner } from "../../dist/infrastructure/database/transaction-runner.js";
import { RedisModule } from "../../dist/infrastructure/cache/redis.module.js";
import { RedisService } from "../../dist/infrastructure/cache/redis.service.js";
import { OutboxDispatcher } from "../../dist/infrastructure/events/outbox-dispatcher.js";
import { OutboxPublisherRegistry } from "../../dist/infrastructure/events/outbox.types.js";
import { StorageModule } from "../../dist/infrastructure/storage/storage.module.js";
import { FileStorageService } from "../../dist/infrastructure/storage/file-storage.service.js";
import { FileAttachmentService } from "../../dist/infrastructure/storage/file-attachment.service.js";
import { AuditModule } from "../../dist/modules/audit/audit.module.js";
import { AuditWriter } from "../../dist/modules/audit/application/services/audit-writer.js";
import { IdentityModule } from "../../dist/modules/identity.module.js";
import { IdentityConfig } from "../../dist/configs/identity.config.js";
import { IdentityGuard } from "../../dist/shared/auth/identity.guard.js";
import { SessionsService } from "../../dist/modules/auth/application/services/sessions.service.js";
import { SkillActorService } from "../../dist/modules/users/application/services/skill-actor.service.js";
import { SharingSkillsModule } from "../../dist/modules/sharing-skills/sharing-skills.module.js";
import { SharingSkillsService } from "../../dist/modules/sharing-skills/application/services/sharing-skills.service.js";
import { LearningRequestsModule } from "../../dist/modules/learning-requests/learning-requests.module.js";
import { LearningRequestLifecycleService } from "../../dist/modules/learning-requests/application/services/learning-request-lifecycle.service.js";
import { LearningPathsModule } from "../../dist/modules/learning-paths/learning-paths.module.js";
import { LearningPathsService } from "../../dist/modules/learning-paths/application/services/learning-paths.service.js";
import { ConversationMembershipReader } from "../../dist/modules/conversations/application/services/conversation-membership.reader.js";
import { ReputationModule } from "../../dist/modules/reputation/reputation.module.js";
import { CreditLedgerAdapter } from "../../dist/modules/credit/application/services/credit-ledger.adapter.js";
import {
  WalletPort,
  PathSettlementPort,
  CreditAdjustmentPort,
} from "../../dist/modules/credit/application/ports/credit.ports.js";
function fixtureModule(entries) {
  class Fixture {}
  Module({
    providers: entries.map(([provide, useValue]) => ({ provide, useValue })),
    exports: entries.map(([provide]) => provide),
  })(Fixture);
  return Fixture;
}
test("feature modules resolve owner contracts and register SSE/chat workers; HTTP metadata includes new routes", async () => {
  const subscriber = new EventEmitter();
  Object.assign(subscriber, {
    connect: async () => {},
    subscribe: async () => {},
    disconnect() {},
  });
  const redis = { duplicate: () => subscriber, publish: async () => 0 };
  const db = { $queryRaw: async () => [] };
  const builder = Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        ignoreEnvFile: true,
        load: [() => ({ EVENT_CURSOR_KEY: "x".repeat(32) })],
      }),
      ProposalsModule,
      LearningPathsModule,
      ReputationModule,
    ],
  })
    .overrideModule(DatabaseModule)
    .useModule(
      fixtureModule([
        [PrismaService, db],
        [TransactionRunner, { run: (work) => work(db) }],
        [getConnectionToken(), {}],
      ]),
    )
    .overrideModule(RedisModule)
    .useModule(fixtureModule([[RedisService, redis]]))
    .overrideModule(IdentityModule)
    .useModule(
      fixtureModule([
        [SessionsService, {}],
        [IdentityConfig, { jwtKey: "fixture-ledger-cursor-key" }],
        [SkillActorService, {}],
        [IdentityGuard, { canActivate: () => true }],
      ]),
    )
    .overrideModule(StorageModule)
    .useModule(
      fixtureModule([
        [FileStorageService, {}],
        [FileAttachmentService, {}],
      ]),
    )
    .overrideModule(AuditModule)
    .useModule(fixtureModule([[AuditWriter, {}]]))
    .overrideModule(SharingSkillsModule)
    .useModule(fixtureModule([[SharingSkillsService, {}]]))
    .overrideModule(LearningRequestsModule)
    .useModule(fixtureModule([[LearningRequestLifecycleService, {}]]))
    .overrideProvider(OutboxDispatcher)
    .useValue({});
  const module = await builder.compile(),
    app = module.createNestApplication();
  try {
    app.setGlobalPrefix("api");
    app.enableVersioning({ type: VersioningType.URI });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    assert(module.get(ProposalsService));
    assert(module.get(ConversationsService));
    assert(module.get(LearningPathsService));
    assert(module.get(ConversationMembershipReader));
    const ledgerAdapter = module.get(CreditLedgerAdapter);
    assert.equal(module.get(WalletPort), ledgerAdapter);
    assert.equal(module.get(PathSettlementPort), ledgerAdapter);
    await assert.rejects(
      module.get(CreditAdjustmentPort).adjust(),
      /CREDIT_ADJUSTMENT_UNAVAILABLE/,
    );
    const registry = module.get(OutboxPublisherRegistry);
    for (const type of [
      "application.events.wakeup",
      "chat.message.publish",
      "learning-request.rejected",
    ])
      assert(registry.get(type), type);
    const doc = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().addBearerAuth().build(),
    );
    for (const route of [
      "/api/v1/proposals",
      "/api/v1/proposals/{id}/accept",
      "/api/v1/conversations/{id}/messages",
      "/api/v1/events",
      "/api/v1/me/achievements",
      "/api/v1/me/wallet",
      "/api/v1/me/wallet/transactions",
      "/api/v1/learning-paths/mine",
      "/api/v1/learning-paths/{pathId}/finalize",
    ])
      assert(doc.paths[route], route);
    assert(
      doc.paths[
        "/api/v1/learning-paths/{pathId}/finalize"
      ].post.parameters.some(
        (parameter) =>
          parameter.in === "header" &&
          parameter.name === "Idempotency-Key" &&
          parameter.required,
      ),
    );
    assert(
      doc.paths["/api/v1/events"].get.responses["200"].content?.[
        "text/event-stream"
      ] ||
        doc.paths["/api/v1/events"].get.responses["200"].description.includes(
          "SSE",
        ),
    );
  } finally {
    await app.close();
  }
});
