import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { Test } from "@nestjs/testing";
import {
  UnauthorizedException,
  ValidationPipe,
  VersioningType,
} from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { SessionsService } from "../../dist/modules/auth/application/services/sessions.service.js";
import { IdentityGuard } from "../../dist/shared/auth/identity.guard.js";
import { SessionChangesService } from "../../dist/modules/learning-sessions/application/services/session-changes.service.js";
import { SessionChangesController } from "../../dist/modules/learning-sessions/presentation/http/session-changes.controller.js";
import { PathTerminationController } from "../../dist/modules/learning-paths/presentation/http/path-termination.controller.js";
import { LearningChangeReviewController } from "../../dist/modules/learning-paths/presentation/http/learning-change-review.controller.js";
import { PathTerminationService } from "../../dist/modules/learning-paths/application/services/path-termination.service.js";
import { PathSettlementStatusController } from "../../dist/modules/learning-paths/presentation/http/path-settlement-status.controller.js";
import { PathSettlementStatusService } from "../../dist/modules/learning-paths/application/services/path-settlement-status.service.js";
import { LearningChangeState } from "../../dist/modules/learning-paths/application/services/learning-change-state.js";
import { AuditWriter } from "../../dist/modules/audit/application/services/audit-writer.js";
import { AuditRepository } from "../../dist/modules/audit/infrastructure/persistence/audit.repository.js";
import { HttpExceptionFilter } from "../../dist/shared/http/http-exception.filter.js";
import { runner } from "../learning-platform/fake-db.mjs";
import {
  setup,
  finalizedOneWay,
  user,
  A,
  B,
  C,
} from "../learning-platform/fixtures.mjs";

test("HTTP cancellation/termination enforce membership, DTOs, idempotency and Admin gates", async () => {
  const ctx = setup({ wallets: { [B]: 10000n } });
  const { session, pathId } = await finalizedOneWay(ctx);
  const changes = new LearningChangeState(
    new AuditWriter(new AuditRepository()),
    ctx.configuration,
  );
  const cancellations = new SessionChangesService(runner(ctx.db), changes);
  const termination = new PathTerminationService(
    runner(ctx.db),
    changes,
    cancellations,
    {},
    ctx.requests,
    ctx.requestPaths,
  );
  const status = new PathSettlementStatusService(
    runner(ctx.db),
    ctx.sessions.reports,
  );
  const module = await Test.createTestingModule({
    controllers: [
      SessionChangesController,
      PathTerminationController,
      LearningChangeReviewController,
      PathSettlementStatusController,
    ],
    providers: [
      IdentityGuard,
      {
        provide: SessionsService,
        useValue: {
          principal: async (token) => {
            if (![A, B, C].includes(token)) throw new UnauthorizedException();
            return user(token);
          },
        },
      },
      { provide: SessionChangesService, useValue: cancellations },
      { provide: PathTerminationService, useValue: termination },
      { provide: PathSettlementStatusService, useValue: status },
    ],
  }).compile();
  const app = module.createNestApplication({ logger: false });
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
  const post = (url, token, body, key) =>
    fetch(base + url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(key ? { "idempotency-key": key } : {}),
      },
      body: JSON.stringify(body),
    });
  try {
    const url = `/sessions/${session.id}/cancellation-requests`;
    const body = {
      reason: "Please agree to makeup",
      expectedStartAt: session.startAt.toISOString(),
    };
    assert.equal((await post(url, null, body, "key")).status, 401);
    assert.equal((await post(url, C, body, "key")).status, 403);
    assert.equal((await post(url, A, body)).status, 400);
    assert.equal(
      (await post(url, A, { ...body, refund: "100.00" }, "key")).status,
      400,
    );
    assert.equal(
      (
        await post(
          url,
          A,
          { ...body, expectedStartAt: "2026-11-02T10:00:00" },
          "key",
        )
      ).status,
      400,
    );
    const created = await post(url, A, body, "key");
    assert.equal(created.status, 201);
    const row = (await created.json()).data;
    const replay = await post(url, A, body, "key");
    assert.equal((await replay.json()).data.id, row.id);
    assert.equal(
      (
        await post(`${url}/${row.id}/response`, B, {
          expectedVersion: 1,
          accept: "true",
        })
      ).status,
      400,
    );
    const applied = await post(`${url}/${row.id}/response`, B, {
      expectedVersion: 1,
      accept: true,
    });
    assert.equal((await applied.json()).data.status, "APPLIED");
    const stop = await post(
      `/learning-paths/${pathId}/termination-requests`,
      A,
      { reason: "End the agreement" },
      "stop",
    );
    const stopId = (await stop.json()).data.id;
    const review = await fetch(
      `${base}/learning-paths/${pathId}/termination-requests/${stopId}/review`,
      { headers: { authorization: `Bearer ${A}` } },
    );
    assert.equal(review.status, 403);
    assert.equal(
      (
        await fetch(`${base}/learning-changes/review-queue`, {
          headers: { authorization: `Bearer ${A}` },
        })
      ).status,
      403,
    );
    const result = await fetch(
      `${base}/learning-paths/${pathId}/settlement-status`,
      { headers: { authorization: `Bearer ${B}` } },
    );
    assert.equal((await result.json()).data.status, "WAITING_TERMINATION");
    const docs = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().build(),
    );
    assert.ok(docs.paths["/api/v1/learning-paths/{pathId}/settlement-status"]);
    assert.ok(
      docs.paths[
        "/api/v1/learning-paths/{pathId}/termination-requests/{requestId}/execute"
      ],
    );
  } finally {
    await app.close();
  }
});
