import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { Test } from "@nestjs/testing";
import { ConfigModule } from "@nestjs/config";
import { ValidationPipe, VersioningType } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { PaymentsModule } from "../../dist/modules/payments/payments.module.js";
import { PayosTransport } from "../../dist/modules/payments/infrastructure/payos-transport.js";
import { DatabaseModule } from "../../dist/infrastructure/database/database.module.js";
import { PrismaService } from "../../dist/infrastructure/database/prisma.service.js";
import { TransactionRunner } from "../../dist/infrastructure/database/transaction-runner.js";
import { IdentityModule } from "../../dist/modules/identity.module.js";
import { IdentityConfig } from "../../dist/configs/identity.config.js";
import { SkillActorService } from "../../dist/modules/users/application/services/skill-actor.service.js";
import { IdentityGuard } from "../../dist/shared/auth/identity.guard.js";
import { SessionsService } from "../../dist/modules/auth/application/services/sessions.service.js";
import { ApplicationEventsModule } from "../../dist/modules/application-events/application-events.module.js";
import { ApplicationEventsService } from "../../dist/modules/application-events/application/application-events.service.js";
import { EventsController } from "../../dist/modules/application-events/presentation/events.controller.js";
import { EventConnectionsService } from "../../dist/modules/application-events/application/event-connections.service.js";
import {
  EventConfig,
  eventSettings,
} from "../../dist/modules/application-events/domain/event-config.js";
import { HttpExceptionFilter } from "../../dist/shared/http/http-exception.filter.js";
import { createPaymentFixture } from "./fixture.mjs";

test("Payment module HTTP/Swagger, live ownership, disabled gate and real SSE frames", async (t) => {
  const f = await createPaymentFixture();
  let app, stream;
  try {
    const owner = await f.account(),
      other = await f.account();
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        PaymentsModule,
        ApplicationEventsModule,
      ],
      controllers: [EventsController],
      providers: [
        {
          provide: EventConfig,
          useValue: {
            values: {
              ...eventSettings({ secret: "fixture-cursor-key".repeat(3) }),
              heartbeatMs: 50,
            },
          },
        },
        {
          provide: EventConnectionsService,
          useValue: {
            acquire: async () => ({
              renew: async () => {},
              release: async () => {},
            }),
          },
        },
        { provide: SessionsService, useValue: f.identity.sessions },
      ],
    })
      .overrideModule(DatabaseModule)
      .useModule({
        module: class PaymentTestDatabase {},
        providers: [
          { provide: TransactionRunner, useValue: f.transactions },
          { provide: PrismaService, useValue: f.db },
        ],
        exports: [TransactionRunner, PrismaService],
      })
      .overrideModule(IdentityModule)
      .useModule({
        module: class PaymentTestIdentity {},
        providers: [
          { provide: SkillActorService, useValue: f.actors },
          {
            provide: IdentityConfig,
            useValue: { jwtKey: "fixture-payment-key" },
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
      .overrideModule(ApplicationEventsModule)
      .useModule({
        module: class PaymentTestEvents {},
        providers: [{ provide: ApplicationEventsService, useValue: f.events }],
        exports: [ApplicationEventsService],
      })
      .overrideProvider(PayosTransport)
      .useValue(f.transport)
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
    const request = async (
      path,
      { account = owner, method = "GET", body, key } = {},
    ) => {
      const response = await fetch(`${base}${path}`, {
        method,
        headers: {
          ...(account ? { authorization: `Bearer ${account.token}` } : {}),
          ...(body ? { "content-type": "application/json" } : {}),
          ...(key ? { "idempotency-key": key } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      return { status: response.status, body: await response.json() };
    };
    await t.test(
      "Swagger contains all payment endpoints, QR/string-money schemas and public signed callback",
      () => {
        const doc = SwaggerModule.createDocument(
          app,
          new DocumentBuilder().addBearerAuth().build(),
        );
        assert.ok(doc.paths["/api/v1/payments"].post.responses["201"]);
        assert.ok(doc.paths["/api/v1/payments"].get.responses["200"]);
        assert.ok(doc.paths["/api/v1/payments/{id}"].get);
        assert.ok(
          doc.paths["/api/v1/payments/webhooks/payos"].post.requestBody,
        );
        assert.equal(
          doc.paths["/api/v1/payments/webhooks/payos"].post.security,
          undefined,
        );
        assert.equal(
          doc.components.schemas.PaymentResponse.properties.creditAmount.type,
          "string",
        );
        assert.equal(
          doc.components.schemas.PaymentResponse.properties.paymentAmountVnd
            .type,
          "string",
        );
        assert.equal(
          doc.components.schemas.PaymentQrResponse.properties.checkoutUrl,
          undefined,
        );
      },
    );
    const body = { paymentAmountVnd: "100000", gateway: "PAYOS" };
    await t.test(
      "validation, missing key and identity fail before calling provider",
      async () => {
        assert.equal(
          (
            await request("/payments", {
              method: "POST",
              body,
              key: randomUUID(),
              account: null,
            })
          ).status,
          401,
        );
        assert.equal(
          (await request("/payments", { method: "POST", body })).status,
          400,
        );
        for (const invalid of [
          { ...body, paymentAmountVnd: 100000 },
          { ...body, paymentAmountVnd: "1001" },
          { ...body, userId: other.user.id },
          { ...body, gateway: "UNKNOWN" },
        ])
          assert.equal(
            (
              await request("/payments", {
                method: "POST",
                body: invalid,
                key: randomUUID(),
              })
            ).status,
            400,
          );
        assert.equal(f.requests.length, 0);
      },
    );
    stream = new AbortController();
    const response = await fetch(`${base}/events`, {
      headers: { authorization: `Bearer ${owner.token}` },
      signal: stream.signal,
    });
    assert.equal(response.status, 200);
    const reader = response.body.getReader();
    const ready = await reader.read();
    assert.match(Buffer.from(ready.value).toString(), /event: stream.ready/);
    const key = randomUUID();
    const created = await request("/payments", { method: "POST", body, key });
    assert.equal(created.status, 201);
    const payment = created.body.data;
    assert.equal(payment.status, "PENDING");
    assert.ok(payment.checkout.qrCode);
    assert.equal(
      (await request("/payments", { method: "POST", body, key })).status,
      200,
    );
    assert.equal(
      (await request(`/payments/${payment.id}`, { account: other })).status,
      404,
    );
    assert.equal((await request("/payments?limit=1")).body.data.length, 1);
    const webhook = await f.webhook(payment);
    await t.test(
      "public callback verifies HMAC and ACKs only committed posting; SSE contains no money or QR",
      async () => {
        assert.equal(
          (
            await request("/payments/webhooks/payos", {
              method: "POST",
              body: { ...webhook, signature: "0".repeat(64) },
              account: null,
            })
          ).status,
          401,
        );
        const posted = await request("/payments/webhooks/payos", {
          method: "POST",
          body: webhook,
          account: null,
        });
        assert.deepEqual(posted, { status: 200, body: { success: true } });
        assert.equal(
          (await request(`/payments/${payment.id}`)).body.data.status,
          "PAID",
        );
        const timer = setTimeout(() => stream.abort(), 5000);
        let frames = "";
        try {
          while (!frames.includes("event: wallet.updated")) {
            const chunk = await reader.read();
            assert.equal(chunk.done, false);
            frames += Buffer.from(chunk.value).toString();
          }
        } finally {
          clearTimeout(timer);
        }
        assert.match(frames, /event: payment.updated/);
        assert.match(frames, /"status":"PAID"/);
        assert.doesNotMatch(
          frames,
          /qrCode|amount|checkoutUrl|private-account/,
        );
      },
    );
    stream.abort();
    await t.test(
      "revoked sessions cannot replay create or read existing orders",
      async () => {
        await f.db.refreshSession.update({
          where: { id: owner.principal.sessionId },
          data: { revokedAt: new Date(), revokedReason: "fixture-revoke" },
        });
        assert.equal((await request(`/payments/${payment.id}`)).status, 401);
        assert.equal(
          (await request("/payments", { method: "POST", body, key })).status,
          401,
        );
      },
    );
    await t.test(
      "disabled provider keeps routes documented but blocks creation",
      async () => {
        const saved = f.transport.config;
        f.transport.config = { enabled: false };
        try {
          assert.equal(
            (
              await request("/payments", {
                account: other,
                method: "POST",
                body,
                key: randomUUID(),
              })
            ).status,
            503,
          );
        } finally {
          f.transport.config = saved;
        }
      },
    );
  } finally {
    stream?.abort();
    await app?.close();
    await f.dispose();
  }
});
