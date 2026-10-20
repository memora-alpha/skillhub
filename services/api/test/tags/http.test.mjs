import "reflect-metadata";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Test } from "@nestjs/testing";
import { ValidationPipe, VersioningType } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { createTagFixture } from "./helpers.mjs";
import { IdentityGuard } from "../../dist/shared/auth/identity.guard.js";
import { SessionsService } from "../../dist/modules/auth/application/services/sessions.service.js";
import { HttpExceptionFilter } from "../../dist/shared/http/http-exception.filter.js";
import { SkillsService } from "../../dist/modules/skills/application/services/skills.service.js";
import { TagsController } from "../../dist/modules/skills/presentation/http/skills.controller.js";
import { CreateLearningRequestUseCase } from "../../dist/modules/learning-requests/application/use-cases/create-learning-request.use-case.js";
import { LearningRequestAccessService } from "../../dist/modules/learning-requests/application/services/learning-request-access.service.js";
import { PrismaLearningRequestRepository } from "../../dist/modules/learning-requests/infrastructure/persistence/prisma-learning-request.repository.js";

test(
  "tag HTTP contracts protect actor fields, request ownership and public lookup",
  { timeout: 180000 },
  async () => {
    const f = await createTagFixture();
    let app;
    try {
      const { TagsService } =
        await import("../../dist/modules/skills/application/services/tags.service.js");
      const { TagRequestsService } =
        await import("../../dist/modules/skills/application/services/tag-requests.service.js");
      const { AdminTagsController } =
        await import("../../dist/modules/skills/presentation/http/admin-tags.controller.js");
      const {
        TagRequestsController,
        MyTagRequestsController,
        AdminTagRequestsController,
      } =
        await import("../../dist/modules/skills/presentation/http/tag-requests.controller.js");
      const module = await Test.createTestingModule({
        controllers: [
          TagsController,
          AdminTagsController,
          TagRequestsController,
          MyTagRequestsController,
          AdminTagRequestsController,
        ],
        providers: [
          { provide: SkillsService, useValue: f.skills },
          { provide: TagsService, useValue: f.tags },
          { provide: TagRequestsService, useValue: f.tagRequests },
          { provide: SessionsService, useValue: f.identity.sessions },
          {
            provide: IdentityGuard,
            useValue: new IdentityGuard(f.identity.sessions),
          },
        ],
      }).compile();
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
      const base = await app.getUrl();
      const admin = await f.account("ADMIN"),
        owner = await f.account(),
        other = await f.account();
      const request = async (method, path, actor, body, key = randomUUID()) => {
        const response = await fetch(`${base}/api/v1${path}`, {
          method,
          headers: {
            ...(actor ? { Authorization: `Bearer ${actor.token}` } : {}),
            ...(body
              ? { "Content-Type": "application/json", "Idempotency-Key": key }
              : {}),
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
        });
        return { status: response.status, body: await response.json() };
      };
      assert.equal(
        (await request("POST", "/tag-requests", undefined, { label: "Rust" }))
          .status,
        401,
      );
      assert.equal(
        (await request("POST", "/admin/tags", owner, { label: "Rust" })).status,
        403,
      );
      for (const body of [
        { label: "Rust", status: "APPROVED" },
        { label: "Rust", requestedByUserId: other.user.id },
        { label: null },
        { label: "x\ny" },
      ]) {
        assert.equal(
          (await request("POST", "/tag-requests", owner, body)).status,
          400,
        );
      }
      assert.equal(
        (await request("POST", "/tag-requests", owner, { label: "Rust" }, ""))
          .status,
        400,
      );
      const submitted = await request("POST", "/tag-requests", owner, {
        label: "Rust",
      });
      assert.equal(submitted.status, 201);
      assert.equal(submitted.body.data.status, "PENDING");
      assert.equal("labelKey" in submitted.body.data, false);
      assert.equal((await request("GET", "/tags")).body.data.length, 0);
      const id = submitted.body.data.id;
      assert.equal(
        (await request("GET", `/me/tag-requests/${id}`, other)).status,
        404,
      );
      assert.equal(
        (await request("GET", "/me/tag-requests?limit=0", owner)).status,
        400,
      );
      assert.equal(
        (await request("GET", "/admin/tag-requests?status=PENDING", admin)).body
          .data.length,
        1,
      );
      const approved = await request(
        "POST",
        `/admin/tag-requests/${id}/approve`,
        admin,
        { expectedVersion: 1 },
      );
      assert.equal(approved.status, 200);
      const tagId = approved.body.data.resultTagId;
      assert.deepEqual((await request("GET", "/tags")).body.data, [
        { id: tagId, label: "Rust" },
      ]);
      const skill = await f.skills.create(f.command(admin), {
        name: "Tag selection",
        status: "ACTIVE",
      });
      const create = new CreateLearningRequestUseCase(
        f.transactions,
        new LearningRequestAccessService(f.identity.sessions),
        f.actors,
        f.skills,
        new PrismaLearningRequestRepository(f.db),
        f.sharing,
      );
      const requestInput = {
        skillId: skill.id,
        tagIds: [tagId],
        title: "Learn Rust ownership",
        description: "I want to understand ownership and borrowing in Rust.",
        learningGoal: "Write a Rust program using ownership and borrowing.",
      };
      const learningRequest = await create.execute(
        owner.principal,
        requestInput,
      );
      assert.deepEqual(learningRequest.tagIds, [tagId]);
      await f.transactions.run((tx) =>
        f.skills.assertActiveSelection(tx, {
          skillId: skill.id,
          tagIds: [tagId],
        }),
      );
      assert.equal(
        (
          await request("PATCH", `/admin/tags/${tagId}`, admin, {
            expectedVersion: 1,
            reason: "Empty",
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await request("PATCH", `/admin/tags/${tagId}`, admin, {
            status: "INACTIVE",
            expectedVersion: 1,
            reason: "Hide",
          })
        ).status,
        200,
      );
      await assert.rejects(
        create.execute(owner.principal, requestInput),
        (error) => error.getStatus() === 409,
      );
      assert.equal(
        await f.db.requestTag.count({
          where: { requestId: learningRequest.id, tagId },
        }),
        1,
      );
      await assert.rejects(
        f.transactions.run((tx) =>
          f.skills.assertActiveSelection(tx, {
            skillId: skill.id,
            tagIds: [tagId],
          }),
        ),
        (error) => error.getStatus() === 409,
      );
      const historical = await f.transactions.run((tx) =>
        f.skills.readSelections(tx, { skillIds: [skill.id], tagIds: [tagId] }),
      );
      assert.equal(historical.tags[0].label, "Rust");
      const schema = SwaggerModule.createDocument(
        app,
        new DocumentBuilder().setTitle("Tags").addBearerAuth().build(),
      );
      const operations = Object.entries(schema.paths).flatMap(
        ([path, methods]) =>
          Object.keys(methods).map((method) => `${method} ${path}`),
      );
      assert.equal(operations.length, 11);
      assert.ok(
        schema.paths["/api/v1/admin/tag-requests/{requestId}/reject"].post
          .responses["409"],
      );
      assert.equal(
        schema.components.schemas.TagResponse.properties.label.maxLength,
        80,
      );
    } finally {
      await app?.close();
      await f.dispose();
    }
  },
);
