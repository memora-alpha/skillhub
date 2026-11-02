import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { ConflictException, VersioningType } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { LearningPathsController } from "../../dist/modules/learning-paths/presentation/http/learning-paths.controller.js";
import { LearningPathsService } from "../../dist/modules/learning-paths/application/services/learning-paths.service.js";
import { IdentityGuard } from "../../dist/shared/auth/identity.guard.js";
import { HttpExceptionFilter } from "../../dist/shared/http/http-exception.filter.js";

const a = "0a0a0a0a-0000-4000-8000-00000000000a";
const b = "0b0b0b0b-0000-4000-8000-00000000000b";
const pathId = "10101010-0000-4000-8000-000000000001";

test("final-validation HTTP includes validated Credit and schedule details", async () => {
  let error = new ConflictException({
    message: "INSUFFICIENT_AVAILABLE_CREDIT",
    userIds: [a, b],
  });
  const module = await Test.createTestingModule({
    controllers: [LearningPathsController],
    providers: [
      {
        provide: LearningPathsService,
        useValue: {
          validateForFinalize: async () => {
            throw error;
          },
          finalize: async () => {
            throw error;
          },
        },
      },
    ],
  })
    .overrideGuard(IdentityGuard)
    .useValue({
      canActivate: (context) => {
        context.switchToHttp().getRequest().principal = {
          userId: a,
          roles: ["USER"],
          permissions: [],
        };
        return true;
      },
    })
    .compile();
  const app = module.createNestApplication({ logger: false });
  try {
    app.setGlobalPrefix("api");
    app.enableVersioning({ type: VersioningType.URI });
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.listen(0, "127.0.0.1");
    const url = `${await app.getUrl()}/api/v1/learning-paths/${pathId}/final-validation`;
    const credit = await fetch(url, { method: "POST" });
    assert.equal(credit.status, 409);
    assert.deepEqual((await credit.json()).details, { userIds: [a, b] });

    const conflict = {
      type: "SESSION",
      affectedUserIds: [a],
      proposed: {
        planId: pathId,
        sessionNo: 1,
        startAt: "2026-11-02T10:00:00.000Z",
        endAt: "2026-11-02T11:00:00.000Z",
      },
      compared: {
        sessionId: "20202020-0000-4000-8000-000000000002",
        planId: "30303030-0000-4000-8000-000000000003",
        sessionNo: 1,
        startAt: "2026-11-02T10:30:00.000Z",
        endAt: "2026-11-02T11:30:00.000Z",
      },
      overlapStartAt: "2026-11-02T10:30:00.000Z",
      overlapEndAt: "2026-11-02T11:00:00.000Z",
    };
    error = new ConflictException({
      message: "SCHEDULE_CONFLICT",
      conflicts: [conflict],
    });
    const schedule = await fetch(url, { method: "POST" });
    assert.equal(schedule.status, 409);
    assert.deepEqual((await schedule.json()).details, {
      conflicts: [conflict],
    });
    const finalized = await fetch(
      `${await app.getUrl()}/api/v1/learning-paths/${pathId}/finalize`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": "test-finalize",
        },
        body: JSON.stringify({ expectedVersion: 1 }),
      },
    );
    assert.equal(finalized.status, 409);
    assert.deepEqual((await finalized.json()).details, {
      conflicts: [conflict],
    });
  } finally {
    await app.close();
  }
});
