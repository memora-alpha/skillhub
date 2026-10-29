import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { ValidationPipe, VersioningType } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { LearningRequestsController } from "../../dist/modules/learning-requests/presentation/http/learning-requests.controller.js";
import { CancelLearningRequestUseCase } from "../../dist/modules/learning-requests/application/use-cases/cancel-learning-request.use-case.js";
import { LearningRequestPathReader } from "../../dist/modules/learning-paths/application/services/learning-request-path.reader.js";
import { IdentityGuard } from "../../dist/shared/auth/identity.guard.js";
import { HttpExceptionFilter } from "../../dist/shared/http/http-exception.filter.js";
import { createFakeDb } from "../learning-platform/fake-db.mjs";

test("cancel HTTP uses the real reader and returns success or business conflict with documented envelope", async () => {
  const owner = "11111111-1111-4111-8111-111111111111";
  const teacher = "22222222-2222-4222-8222-222222222222";
  const id = "33333333-3333-4333-8333-333333333333";
  const db = createFakeDb();
  const row = db.seed("learningRequest", {
    id,
    ownerId: owner,
    status: "NEGOTIATING",
    version: 2,
    preferredSlots: [],
    tagLinks: [],
  });
  db.seed("proposal", {
    id: "proposal",
    requestId: id,
    status: "ACCEPTED",
    sourceType: "LEARNING_REQUEST",
    proposerId: teacher,
    recipientId: owner,
  });
  db.seed("conversation", {
    id: "conversation",
    proposalId: "proposal",
    requestId: id,
    participantAId: teacher,
    participantBId: owner,
  });
  const path = db.seed("learningPath", {
    id: "path",
    conversationId: "conversation",
    participantAId: teacher,
    participantBId: owner,
    status: "CONFIRMED",
  });
  const useCase = new CancelLearningRequestUseCase(
    { run: (work) => work(db) },
    { assertUserAction: async (_tx, actor) => actor },
    {
      lock: async () => row,
      databaseNow: async () => new Date(),
      transition: async (_tx, _id, version, statuses, data) => {
        if (row.version !== version || !statuses.includes(row.status))
          return false;
        Object.assign(row, data, { version: version + 1 });
        return true;
      },
    },
    new LearningRequestPathReader(),
  );
  let userId = owner;
  const module = await Test.createTestingModule({
    controllers: [LearningRequestsController],
    providers: Reflect.getMetadata(
      "design:paramtypes",
      LearningRequestsController,
    ).map((token) => ({
      provide: token,
      useValue: token === CancelLearningRequestUseCase ? useCase : {},
    })),
  })
    .overrideGuard(IdentityGuard)
    .useValue({
      canActivate: (ctx) => {
        ctx.switchToHttp().getRequest().principal = { userId };
        return true;
      },
    })
    .compile();
  const app = module.createNestApplication();
  app.setGlobalPrefix("api");
  app.enableVersioning({ type: VersioningType.URI });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  try {
    const doc = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().build(),
    );
    const route =
      doc.paths["/api/v1/learning-requests/{requestId}/cancel"].post;
    assert.ok(route.responses[409]);
    assert.match(route.description, /REQUEST_LOCKED/);
    await app.listen(0, "127.0.0.1");
    const call = async (expectedVersion = 2) => {
      const response = await fetch(
        `${await app.getUrl()}/api/v1/learning-requests/${id}/cancel`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ expectedVersion }),
        },
      );
      return [response.status, await response.json()];
    };
    let [status, body] = await call();
    assert.equal(status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.status, "CANCELLED");
    Object.assign(row, { status: "NEGOTIATING", version: 2 });
    path.lockedVersion = 1;
    [status, body] = await call();
    assert.equal(status, 409);
    assert.deepEqual(body, {
      success: false,
      statusCode: 409,
      message: "REQUEST_LOCKED",
    });
    [status, body] = await call(1);
    assert.equal(status, 409);
    assert.equal(body.message, "REQUEST_VERSION_CONFLICT");
    userId = teacher;
    [status] = await call();
    assert.equal(status, 404);
  } finally {
    await app.close();
  }
});
