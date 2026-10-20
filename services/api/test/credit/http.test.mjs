import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { Test } from "@nestjs/testing";
import { ValidationPipe, VersioningType } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { CreditModule } from "../../dist/modules/credit/credit.module.js";
import { IdentityModule } from "../../dist/modules/identity.module.js";
import { IdentityConfig } from "../../dist/configs/identity.config.js";
import { DatabaseModule } from "../../dist/infrastructure/database/database.module.js";
import { TransactionRunner } from "../../dist/infrastructure/database/transaction-runner.js";
import { SkillActorService } from "../../dist/modules/users/application/services/skill-actor.service.js";
import { LearningSessionsController } from "../../dist/modules/learning-sessions/presentation/http/learning-sessions.controller.js";
import { LearningSessionsService } from "../../dist/modules/learning-sessions/application/services/learning-sessions.service.js";
import { IdentityGuard } from "../../dist/shared/auth/identity.guard.js";
import { SessionsService } from "../../dist/modules/auth/application/services/sessions.service.js";
import { HttpExceptionFilter } from "../../dist/shared/http/http-exception.filter.js";
import { createCreditFixture } from "./fixture.mjs";

test("wallet HTTP uses live identity, exact strings, snapshot cursors and own-only history", async (t) => {
  const f = await createCreditFixture();
  let app;
  try {
    const owner = await f.account(),
      other = await f.account();
    const module = await Test.createTestingModule({
      imports: [CreditModule, IdentityModule],
      controllers: [LearningSessionsController],
      providers: [
        // Exercise the real service/controller serialization together; wallet routes use real PG.
        {
          provide: LearningSessionsService,
          useValue: new LearningSessionsService(
            {
              run: (work) =>
                work({
                  $queryRaw: async () => [{ id: "settled-path" }],
                  learningPath: {
                    findUniqueOrThrow: async () => ({
                      participantAId: owner.user.id,
                      participantBId: other.user.id,
                      settledAt: new Date(),
                      settlementOperationId: randomUUID(),
                      settlementGrossAmount: 1001n,
                      settlementFeeAmount: 40n,
                      status: "COMPLETED",
                    }),
                  },
                }),
            },
            {},
            {},
            {},
            {},
            {},
          ),
        },
      ],
    })
      .overrideModule(DatabaseModule)
      .useModule({
        module: class CreditTestDatabase {},
        providers: [{ provide: TransactionRunner, useValue: f.transactions }],
        exports: [TransactionRunner],
      })
      .overrideModule(IdentityModule)
      .useModule({
        module: class CreditTestIdentity {},
        providers: [
          { provide: SkillActorService, useValue: f.actors },
          {
            provide: IdentityConfig,
            useValue: { jwtKey: "fixture-module-cursor-key" },
          },
          { provide: SessionsService, useValue: f.identity.sessions },
          {
            provide: IdentityGuard,
            useValue: new IdentityGuard(f.identity.sessions),
          },
        ],
        exports: [
          SkillActorService,
          IdentityConfig,
          SessionsService,
          IdentityGuard,
        ],
      })
      .compile();
    app = module.createNestApplication({ logger: false });
    app.setGlobalPrefix("api");
    app.enableVersioning({ type: VersioningType.URI });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.listen(0, "127.0.0.1");
    const base = `${await app.getUrl()}/api/v1`;
    await t.test(
      "actual Credit module composes and publishes OpenAPI money contracts",
      () => {
        const document = SwaggerModule.createDocument(
          app,
          new DocumentBuilder().build(),
        );
        assert.ok(document.paths["/api/v1/me/wallet"]?.get?.responses["200"]);
        assert.ok(
          document.paths["/api/v1/me/wallet/transactions"]?.get?.responses[
            "200"
          ],
        );
        assert.equal(
          document.components.schemas.WalletResponse.properties.availableCredit
            .type,
          "string",
        );
      },
    );
    const request = async (path, account = owner, method = "GET") => {
      const response = await fetch(`${base}${path}`, {
        method,
        headers: account ? { Authorization: `Bearer ${account.token}` } : {},
      });
      return { status: response.status, body: await response.json() };
    };
    await t.test("zero reads do not initialize or award a wallet", async () => {
      const response = await request("/me/wallet");
      assert.equal(response.status, 200);
      assert.deepEqual(response.body.data, {
        availableCredit: "0.00",
        heldCredit: "0.00",
        walletVersion: 0,
      });
      assert.equal(
        await f.db.creditWallet.count({ where: { userId: owner.user.id } }),
        0,
      );
      assert.equal((await request("/me/wallet", null)).status, 401);
    });
    let entry;
    await t.test(
      "history excludes concurrent appends from the captured watermark",
      async () => {
        entry = await f.post(owner.user.id, 1001n);
        await f.post(owner.user.id, 1n);
        const first = await request("/me/wallet/transactions?limit=1");
        assert.equal(first.status, 200);
        assert.equal(first.body.data[0].amount, "0.01");
        const cursor = first.body.meta.pagination.nextCursor;
        await f.post(owner.user.id, 200n);
        const next = await request(
          `/me/wallet/transactions?limit=1&cursor=${encodeURIComponent(cursor)}`,
        );
        assert.equal(next.body.data[0].id, entry.id);
        assert.equal(next.body.meta.pagination.hasMore, false);
        assert.equal(
          (
            await request(
              `/me/wallet/transactions?type=HOLD&cursor=${encodeURIComponent(cursor)}`,
            )
          ).status,
          400,
        );
        assert.equal(
          (
            await request(
              `/me/wallet/transactions?cursor=${encodeURIComponent(cursor)}`,
              other,
            )
          ).status,
          400,
        );
      },
    );
    await t.test(
      "money DTOs serialize, ownership and query input are enforced",
      async () => {
        const detail = await request(`/me/wallet/transactions/${entry.id}`);
        assert.equal(detail.status, 200);
        assert.equal(detail.body.data.amount, "10.01");
        assert.equal(detail.body.data.availableDelta, "10.01");
        assert.equal(detail.body.data.referenceType, "SYSTEM");
        assert.equal(
          (await request(`/me/wallet/transactions/${entry.id}`, other)).status,
          404,
        );
        assert.equal(
          (await request("/me/wallet/transactions?limit=101")).status,
          400,
        );
        assert.equal(
          (await request("/me/wallet/transactions?type=FAKE")).status,
          400,
        );
        assert.equal(
          (await request("/me/wallet/transactions?userId=other")).status,
          400,
        );
        const settlement = await request(
          `/sessions/paths/${randomUUID()}/settlement`,
          owner,
          "POST",
        );
        assert.equal(settlement.status, 201);
        assert.equal(settlement.body.data.gross, "10.01");
        assert.equal(settlement.body.data.fee, "0.40");
      },
    );
    await t.test("revoked session cannot replay reads", async () => {
      await f.db.refreshSession.update({
        where: { id: owner.principal.sessionId },
        data: { revokedAt: new Date(), revokedReason: "TEST_REVOKED" },
      });
      assert.equal((await request("/me/wallet")).status, 401);
    });
  } finally {
    await app?.close();
    await f.dispose();
  }
});
