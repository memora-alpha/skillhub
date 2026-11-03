import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash, randomUUID } from "node:crypto";
import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import {
  UnauthorizedException,
  ValidationPipe,
  VersioningType,
} from "@nestjs/common";
import { AccessToken } from "livekit-server-sdk";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { SessionsService } from "../../dist/modules/auth/application/services/sessions.service.js";
import { IdentityGuard } from "../../dist/shared/auth/identity.guard.js";
import { SessionOutcomeService } from "../../dist/modules/learning-sessions/application/services/session-outcome.service.js";
import { LearningSessionsService } from "../../dist/modules/learning-sessions/application/services/learning-sessions.service.js";
import { LearningSessionsController } from "../../dist/modules/learning-sessions/presentation/http/learning-sessions.controller.js";
import { LiveKitWebhookController } from "../../dist/modules/learning-sessions/presentation/http/livekit-webhook.controller.js";
import { LiveKitService } from "../../dist/modules/learning-sessions/infrastructure/livekit/livekit.service.js";
import { OutboxConsumer } from "../../dist/infrastructure/events/outbox-consumer.js";
import { ReportsService } from "../../dist/modules/reports/application/services/reports.service.js";
import { runner } from "../learning-platform/fake-db.mjs";
import { HttpExceptionFilter } from "../../dist/shared/http/http-exception.filter.js";
import {
  finalizedOneWay,
  setup,
  user,
  fakeOutboxConsumer,
  A,
  B,
  C,
} from "../learning-platform/fixtures.mjs";

test("HTTP token auth/validation/no-store and raw signed webhook ingress", async () => {
  const ctx = setup({
    wallets: { [B]: 10000n },
    config: { "livekit.joinWindow": { earlyMinutes: 10, lateMinutes: 10 } },
  });
  const { session } = await finalizedOneWay(ctx);
  ctx.clock.now = new Date(+session.startAt + 1000);
  const key = "http-key",
    secret = "http-secret-for-tests";
  const livekit = new LiveKitService(
    new ConfigService({
      LIVEKIT_URL: "wss://example.livekit.cloud",
      LIVEKIT_API_KEY: key,
      LIVEKIT_API_SECRET: secret,
    }),
  );
  ctx.sessions.livekit = livekit;
  const consumer = fakeOutboxConsumer(ctx.db);
  const outcomes = new SessionOutcomeService(
    runner(ctx.db),
    {},
    new ReportsService(
      runner(ctx.db),
      {},
      {},
      { append: async () => {} },
      {},
      {},
      ctx.configuration,
    ),
  );
  const module = await Test.createTestingModule({
    controllers: [LearningSessionsController, LiveKitWebhookController],
    providers: [
      { provide: SessionOutcomeService, useValue: outcomes },
      IdentityGuard,
      {
        provide: SessionsService,
        useValue: {
          principal: async (token) => {
            if (![A, B, C].includes(token)) throw new UnauthorizedException();
            return {
              ...user(token),
              permissions: ["livekit-token:issue:participant"],
            };
          },
        },
      },
      { provide: LearningSessionsService, useValue: ctx.sessions },
      { provide: LiveKitService, useValue: livekit },
      { provide: OutboxConsumer, useValue: consumer },
    ],
  }).compile();
  const app = module.createNestApplication({ logger: false, rawBody: true });
  app.useBodyParser("json", {
    type: ["application/json", "application/webhook+json"],
    limit: "100kb",
  });
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
  const base = await app.getUrl();
  const endpoint = `${base}/api/v1/sessions/${session.id}/livekit-token`;
  const post = (token, body = {}) =>
    fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
  try {
    assert.equal((await post()).status, 401);
    assert.equal((await post(C)).status, 403);
    assert.equal((await post(A, { userId: C })).status, 400);
    const response = await post(A);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const result = await response.json();
    assert.equal(result.success, true);
    assert.equal(result.data.participantIdentity, `${session.id}:${A}`);
    const swagger = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().build(),
    );
    assert.ok(
      swagger.paths["/api/v1/sessions/{sessionId}/livekit-token"].post
        .responses[200].content["application/json"].schema.properties.data,
    );

    const webhook = `${base}/api/v1/livekit/webhook`;
    const body = JSON.stringify({
      id: randomUUID(),
      event: "participant_joined",
      createdAt: Math.floor(+ctx.clock.now / 1000),
      room: { name: result.data.roomName, sid: "RM_http" },
      participant: { identity: result.data.participantIdentity },
    });
    const sign = async (raw) => {
      const signer = new AccessToken(key, secret, { ttl: 120 });
      signer.sha256 = createHash("sha256").update(raw).digest("base64");
      return signer.toJwt();
    };
    const auth = await sign(body);
    const deliver = (raw, authorization) =>
      fetch(webhook, {
        method: "POST",
        headers: { "content-type": "application/webhook+json", authorization },
        body: raw,
      });
    assert.equal((await deliver(body + " ", auth)).status, 401);
    assert.equal(consumer.receipts.size, 0);
    assert.equal((await deliver(body, auth)).status, 204);
    assert.equal((await deliver(body, auth)).status, 204);
    assert.equal(consumer.receipts.size, 1);
    assert.equal(ctx.db.rows("session")[0].status, "ONGOING");
    const cloudBody = JSON.stringify({
      ...JSON.parse(body),
      id: "EV_cloudSmokeRetry01",
    });
    const cloudAuth = await sign(cloudBody);
    assert.equal((await deliver(cloudBody, cloudAuth)).status, 204);
    assert.equal((await deliver(cloudBody, cloudAuth)).status, 204);
    assert.equal(consumer.receipts.size, 2);
    for (const receipt of consumer.receipts)
      assert.match(
        receipt,
        /^livekit\.session-lifecycle:[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/,
      );
    const missingId = JSON.stringify({ ...JSON.parse(body), id: "" });
    assert.equal((await deliver(missingId, await sign(missingId))).status, 400);
    assert.equal(consumer.receipts.size, 2);
    const slightlyFuture = JSON.stringify({
      ...JSON.parse(body),
      id: "EV_clockSkewRetry01",
      createdAt: Math.floor(+ctx.clock.now / 1000) + 1,
      participant: { identity: `${session.id}:${B}` },
    });
    const futureAuth = await sign(slightlyFuture);
    assert.equal((await deliver(slightlyFuture, futureAuth)).status, 204);
    assert.equal((await deliver(slightlyFuture, futureAuth)).status, 204);
    assert.equal(consumer.receipts.size, 3);
    assert.equal(
      +ctx.db.rows("session")[0].learnerFirstJoinedAt,
      +ctx.clock.now,
    );
    const future = JSON.stringify({
      ...JSON.parse(body),
      id: "EV_futureRetry01",
      createdAt: Math.floor(+ctx.clock.now / 1000) + 60,
    });
    const farFutureAuth = await sign(future);
    assert.equal((await deliver(future, farFutureAuth)).status, 503);
    assert.equal(consumer.receipts.size, 3);
    ctx.clock.now = new Date(+ctx.clock.now + 60000);
    assert.equal((await deliver(future, farFutureAuth)).status, 204);
    assert.equal(consumer.receipts.size, 4);
    assert.equal((await deliver("{", auth)).status, 400);

    // Exercise both excuse routes through the real controller, validator and services.
    await ctx.db.session.update({
      where: { id: session.id },
      data: { lastObservedAt: new Date(+session.startAt + 30 * 60000) },
    });
    ctx.db.seed("sessionAttendanceInterval", {
      sessionId: session.id,
      userId: A,
      role: "TEACHER",
      roomSid: "RM_http",
      participantSid: "PA_http_teacher",
      joinedAt: session.startAt,
      leftAt: session.endAt,
      lastSeenAt: session.endAt,
    });
    ctx.clock.now = new Date(+session.endAt + 21 * 60000);
    await ctx.sessions.ensureDetermined(session.id);
    const excuse = (token, body, suffix = "") =>
      fetch(`${base}/api/v1/sessions/${session.id}/absence-excuse${suffix}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });
    assert.equal(
      (await excuse(null, { reason: "A valid absence explanation" })).status,
      401,
    );
    assert.equal(
      (await excuse(C, { reason: "A valid absence explanation" })).status,
      403,
    );
    assert.equal(
      (await excuse(A, { reason: "I was present throughout" })).status,
      409,
    );
    assert.equal((await excuse(B, { reason: "          " })).status, 400);
    const submitted = await excuse(B, { reason: "An unexpected power outage" });
    assert.equal(submitted.status, 201);
    assert.equal((await submitted.json()).data.status, "PENDING");
    assert.equal((await excuse(B, { accept: true }, "/decision")).status, 409);
    assert.equal(
      (await excuse(A, { accept: "true" }, "/decision")).status,
      400,
    );
    const accepted = await excuse(
      A,
      { accept: true, note: "Let's arrange a makeup" },
      "/decision",
    );
    assert.equal(accepted.status, 200);
    assert.equal((await accepted.json()).data.status, "ACCEPTED");
    assert.equal(ctx.db.rows("session")[0].status, "MAKEUP_REQUIRED");
  } finally {
    await app.close();
  }
});
