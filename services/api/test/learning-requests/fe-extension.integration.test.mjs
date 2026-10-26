import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { createSkillFixture } from "../skills/helpers.mjs";
import { LearningRequestAccessService } from "../../dist/modules/learning-requests/application/services/learning-request-access.service.js";
import { PrismaLearningRequestRepository } from "../../dist/modules/learning-requests/infrastructure/persistence/prisma-learning-request.repository.js";
import { CreateLearningRequestUseCase } from "../../dist/modules/learning-requests/application/use-cases/create-learning-request.use-case.js";
import { EditLearningRequestUseCase } from "../../dist/modules/learning-requests/application/use-cases/edit-learning-request.use-case.js";
import { PublishLearningRequestUseCase } from "../../dist/modules/learning-requests/application/use-cases/publish-learning-request.use-case.js";
import { GetLearningRequestUseCase } from "../../dist/modules/learning-requests/application/use-cases/get-learning-request.use-case.js";
import { ListLearningRequestsUseCase } from "../../dist/modules/learning-requests/application/use-cases/list-learning-requests.use-case.js";
import { CancelLearningRequestUseCase } from "../../dist/modules/learning-requests/application/use-cases/cancel-learning-request.use-case.js";
import { LearningRequestsController } from "../../dist/modules/learning-requests/presentation/http/learning-requests.controller.js";
import { SessionsService } from "../../dist/modules/auth/application/services/sessions.service.js";
import { Test } from "@nestjs/testing";
import { ValidationPipe, VersioningType } from "@nestjs/common";
import { HttpExceptionFilter } from "../../dist/shared/http/http-exception.filter.js";

test(
  "FE request preferences persist and project through real PostgreSQL owner contracts",
  { timeout: 120000 },
  async (t) => {
    const f = await createSkillFixture();
    try {
      const admin = await f.account("ADMIN"),
        owner = await f.account(),
        viewer = await f.account();
      const learn = await f.skills.create(f.command(admin), {
        name: "React fundamentals",
        status: "ACTIVE",
      });
      const teach = await f.skills.create(f.command(admin), {
        name: "JavaScript fundamentals",
        status: "ACTIVE",
      });
      const offered = await f.sharing.create(f.command(owner), {
        skillId: teach.id,
        level: "ADVANCED",
        description: "I can explain JavaScript fundamentals to beginners.",
      });
      const foreign = await f.sharing.create(f.command(viewer), {
        skillId: learn.id,
        level: "ADVANCED",
        description: "I can teach React hooks and composition clearly.",
      });
      const access = new LearningRequestAccessService(f.identity.sessions);
      const repo = new PrismaLearningRequestRepository(f.db);
      const config = {
        getSnapshot: async () => ({
          values: {
            "learningRequest.moderationRuleSet": {
              rules: [{ category: "TEST", pattern: "prohibited" }],
            },
          },
          versions: { "learningRequest.moderationRuleSet": 1 },
        }),
      };
      const create = new CreateLearningRequestUseCase(
        f.transactions,
        access,
        f.actors,
        f.skills,
        repo,
        f.sharing,
      );
      const edit = new EditLearningRequestUseCase(
        f.transactions,
        access,
        f.skills,
        repo,
        config,
        f.sharing,
      );
      const publish = new PublishLearningRequestUseCase(
        f.transactions,
        access,
        f.actors,
        repo,
        f.skills,
        config,
        f.sharing,
      );
      const get = new GetLearningRequestUseCase(
        f.transactions,
        access,
        repo,
        f.skills,
        f.actors,
        f.sharing,
      );
      const list = new ListLearningRequestsUseCase(
        f.transactions,
        access,
        repo,
        f.skills,
        f.actors,
        f.sharing,
      );
      const weekly = {
        timeZone: "Asia/Ho_Chi_Minh",
        weeklySlots: [{ weekday: "MON", startTime: "19:00", endTime: "21:00" }],
      };
      const payload = {
        title: "Learn React from basics",
        skillId: learn.id,
        description:
          "I want to learn React hooks and build reusable components.",
        learningGoal: "Build a complete React application.",
        teachingOverview: "I can teach JavaScript fundamentals in exchange.",
        offeredSharingSkillIds: [offered.id],
        preferredAvailability: weekly,
        desiredCreditPerHour: "50",
      };
      let request;
      await t.test(
        "creation stores a linked owned offering, weekly wall clock and integer hundredths",
        async () => {
          request = await create.execute(owner.principal, payload);
          assert.equal(request.desiredCreditPerHour, "50.00");
          assert.deepEqual(request.preferredAvailability, weekly);
          assert.equal(request.offeredSharingSkills[0].skill.id, teach.id);
          const stored = await f.db.learningRequest.findUniqueOrThrow({
            where: { id: request.id },
            include: { offeringLinks: true },
          });
          assert.equal(stored.desiredCreditPerHour, 5000n);
          assert.equal(stored.offeringLinks[0].sharingSkillId, offered.id);
          await assert.rejects(
            () =>
              create.execute(owner.principal, {
                ...payload,
                offeredSharingSkillIds: [foreign.id],
              }),
            (e) => e.getStatus() === 404,
          );
          assert.equal(await f.db.learningRequest.count(), 1);
          await assert.rejects(
            () =>
              f.db
                .$executeRaw`UPDATE learning_requests SET preferred_availability='{}'::jsonb WHERE request_id=${request.id}::uuid`,
          );
          await assert.rejects(
            () =>
              f.db
                .$executeRaw`UPDATE learning_requests SET desired_credit_per_hour=0 WHERE request_id=${request.id}::uuid`,
          );
        },
      );
      await t.test(
        "publish and public detail/feed/recommendations include the approved card fields",
        async () => {
          request = await publish.execute(owner.principal, request.id, {
            expectedVersion: request.version,
          });
          assert.equal(request.status, "OPEN");
          const detail = await get.execute(viewer.principal, request.id);
          const feed = (await list.execute(viewer.principal, "FEED", {}))
            .items[0];
          const recommended = (
            await list.execute(viewer.principal, "RECOMMENDED", {})
          ).items[0];
          for (const card of [detail, feed, recommended]) {
            assert.equal(card.desiredCreditPerHour, "50.00");
            assert.equal(card.teachingOverview, payload.teachingOverview);
            assert.deepEqual(card.preferredAvailability, weekly);
            assert.equal(card.offeredSharingSkills[0].id, offered.id);
            assert.equal("offeredSharingSkillIds" in card, false);
            assert.equal("ownerId" in card.offeredSharingSkills[0], false);
          }
        },
      );
      await t.test(
        "public owner avatar reads the selected asset and its current state from PostgreSQL",
        async () => {
          const userId = owner.principal.userId;
          const first = await f.db.avatarAsset.create({
            data: {
              userId,
              storageKey: `avatars/${userId}/${randomUUID()}`,
              state: "CLEAN",
              mime: "image/png",
              byteSize: 1n,
            },
          });
          const second = await f.db.avatarAsset.create({
            data: {
              userId,
              storageKey: `avatars/${userId}/${randomUUID()}`,
              state: "CLEAN",
              mime: "image/png",
              byteSize: 1n,
            },
          });
          const readCards = async () => [
            await get.execute(viewer.principal, request.id),
            ...(await list.execute(viewer.principal, "FEED", {})).items,
            ...(await list.execute(viewer.principal, "RECOMMENDED", {})).items,
          ];
          for (const card of await readCards())
            assert.equal(card.owner.avatarUrl, null);
          for (const asset of [first, second]) {
            await f.db.user.update({
              where: { id: userId },
              data: { avatarAssetId: asset.id },
            });
            for (const card of await readCards()) {
              assert.equal(
                card.owner.avatarUrl,
                `https://avatar.test/${asset.storageKey}`,
              );
              assert.deepEqual(
                Object.keys(card.owner).sort((a, b) => a.localeCompare(b)),
                ["avatarUrl", "displayName", "id"],
              );
            }
          }
          for (const state of ["QUARANTINED", "REJECTED", "DELETED"]) {
            await f.db.avatarAsset.update({
              where: { id: second.id },
              data: { state },
            });
            for (const card of await readCards())
              assert.equal(card.owner.avatarUrl, null);
          }
          await f.db.user.update({
            where: { id: userId },
            data: { avatarAssetId: null },
          });
          for (const card of await readCards())
            assert.equal(card.owner.avatarUrl, null);
        },
      );
      await t.test(
        "legacy partial edits preserve new fields; schedule replacements clear the old format",
        async () => {
          request = await edit.execute(owner.principal, request.id, {
            expectedVersion: request.version,
            title: "Learn React practical basics",
          });
          assert.equal(request.desiredCreditPerHour, "50.00");
          assert.deepEqual(request.offeredSharingSkillIds, [offered.id]);
          const future = new Date(Date.now() + 86_400_000);
          request = await edit.execute(owner.principal, request.id, {
            expectedVersion: request.version,
            preferredSlots: [
              {
                startAt: future.toISOString(),
                endAt: new Date(future.getTime() + 3_600_000).toISOString(),
              },
            ],
          });
          assert.equal(request.preferredAvailability, null);
          assert.equal(request.preferredSlots.length, 1);
          request = await edit.execute(owner.principal, request.id, {
            expectedVersion: request.version,
            preferredAvailability: weekly,
          });
          assert.deepEqual(request.preferredSlots, []);
          assert.deepEqual(request.preferredAvailability, weekly);
          await assert.rejects(
            () =>
              edit.execute(owner.principal, request.id, {
                expectedVersion: request.version - 1,
                desiredCreditPerHour: "60",
              }),
            (e) => e.getStatus() === 409,
          );
          assert.equal(
            (await get.execute(owner.principal, request.id))
              .desiredCreditPerHour,
            "50.00",
          );
        },
      );
      await t.test(
        "profile visibility is respected without removing historical selections",
        async () => {
          await f.db.sharingSkill.update({
            where: { id: offered.id },
            data: { isVisible: false },
          });
          assert.deepEqual(
            (await get.execute(viewer.principal, request.id))
              .offeredSharingSkills,
            [],
          );
          assert.deepEqual(
            (await get.execute(owner.principal, request.id))
              .offeredSharingSkillIds,
            [offered.id],
          );
          await assert.rejects(
            () =>
              edit.execute(owner.principal, request.id, {
                expectedVersion: request.version,
                desiredCreditPerHour: "60",
              }),
            (e) => e.getStatus() === 409,
          );
          await f.db.sharingSkill.update({
            where: { id: offered.id },
            data: { isVisible: true },
          });
          request = await edit.execute(owner.principal, request.id, {
            expectedVersion: request.version,
            teachingOverview: null,
            preferredAvailability: null,
            desiredCreditPerHour: null,
            offeredSharingSkillIds: [],
          });
          assert.equal(request.teachingOverview, null);
          assert.equal(request.preferredAvailability, null);
          assert.equal(request.desiredCreditPerHour, null);
          assert.deepEqual(request.offeredSharingSkills, []);
          assert.equal(await f.db.requestOffering.count(), 0);
        },
      );
      await t.test(
        "editing the teaching overview reruns moderation and persists the new version",
        async () => {
          request = await edit.execute(owner.principal, request.id, {
            expectedVersion: request.version,
            teachingOverview:
              "I propose a prohibited teaching offer in exchange.",
          });
          assert.equal(request.status, "PENDING_MODERATION");
          const stored = await f.db.learningRequest.findUniqueOrThrow({
            where: { id: request.id },
          });
          assert.deepEqual(stored.flaggedCategories, ["TEST"]);
          assert.equal(stored.version, request.version);
        },
      );
      await t.test(
        "HTTP create/publish/PATCH/get/cancel use the new contract with real auth and storage",
        async () => {
          const cancel = new CancelLearningRequestUseCase(
            f.transactions,
            access,
            repo,
            { assertNotLocked: async () => {} },
            f.sharing,
          );
          const module = await Test.createTestingModule({
            controllers: [LearningRequestsController],
            providers: [
              { provide: CreateLearningRequestUseCase, useValue: create },
              { provide: EditLearningRequestUseCase, useValue: edit },
              { provide: PublishLearningRequestUseCase, useValue: publish },
              { provide: GetLearningRequestUseCase, useValue: get },
              { provide: ListLearningRequestsUseCase, useValue: list },
              { provide: CancelLearningRequestUseCase, useValue: cancel },
              { provide: SessionsService, useValue: f.identity.sessions },
            ],
          }).compile();
          const app = module.createNestApplication();
          app.useGlobalFilters(new HttpExceptionFilter());
          app.setGlobalPrefix("api");
          app.enableVersioning({
            type: VersioningType.URI,
            defaultVersion: "1",
          });
          app.useGlobalPipes(
            new ValidationPipe({
              transform: true,
              whitelist: true,
              forbidNonWhitelisted: true,
            }),
          );
          try {
            await app.listen(0, "127.0.0.1");
            const base = await app.getUrl();
            const call = (method, path, body, token = owner.token) =>
              fetch(`${base}/api/v1/learning-requests${path}`, {
                method,
                headers: {
                  "Content-Type": "application/json",
                  ...(token ? { authorization: `Bearer ${token}` } : {}),
                },
                ...(body === undefined ? {} : { body: JSON.stringify(body) }),
              });
            assert.equal((await call("POST", "", payload, null)).status, 401);
            assert.equal(
              (await call("POST", "", { ...payload, desiredCreditPerHour: 50 }))
                .status,
              400,
            );
            assert.equal(
              (
                await call("POST", "", {
                  ...payload,
                  preferredAvailability: {
                    ...weekly,
                    weeklySlots: [
                      { ...weekly.weeklySlots[0], offset: "+07:00" },
                    ],
                  },
                })
              ).status,
              400,
            );
            assert.equal(
              (
                await call("POST", "", {
                  ...payload,
                  offeredSharingSkillIds: [
                    offered.id,
                    offered.id.toUpperCase(),
                  ],
                })
              ).status,
              400,
            );
            assert.equal(
              (
                await call("POST", "", {
                  ...payload,
                  preferredAvailability: { ...weekly, timeZone: "+07:00" },
                })
              ).status,
              400,
            );
            const created = await call("POST", "", {
              ...payload,
              offeredSharingSkillIds: [offered.id.toUpperCase()],
            });
            assert.equal(created.status, 201);
            let result = (await created.json()).data;
            assert.equal(result.desiredCreditPerHour, "50.00");
            const mine = await call("GET", "/mine");
            assert.equal(mine.status, 200);
            const ownerRequests = (await mine.json()).data;
            const own = ownerRequests.find((item) => item.id === result.id);
            assert.ok(own);
            assert.equal(own.desiredCreditPerHour, "50.00");
            assert.deepEqual(own.preferredAvailability, weekly);
            assert.deepEqual(own.offeredSharingSkillIds, [offered.id]);
            let response = await call("POST", `/${result.id}/publish`, {
              expectedVersion: result.version,
            });
            assert.equal(response.status, 200);
            result = (await response.json()).data;
            response = await call("PATCH", `/${result.id}`, {
              expectedVersion: result.version,
              desiredCreditPerHour: "50.25",
              offeredSharingSkillIds: [offered.id.toUpperCase()],
            });
            assert.equal(response.status, 200);
            result = (await response.json()).data;
            assert.equal(result.desiredCreditPerHour, "50.25");
            assert.equal(result.offeredSharingSkills[0].id, offered.id);
            response = await call(
              "GET",
              `/${result.id}`,
              undefined,
              viewer.token,
            );
            assert.equal(response.status, 200);
            const publicCard = (await response.json()).data;
            assert.equal(publicCard.offeredSharingSkills[0].id, offered.id);
            assert.equal(publicCard.desiredCreditPerHour, "50.25");
            response = await call("POST", `/${result.id}/cancel`, {
              expectedVersion: result.version,
            });
            assert.equal(response.status, 200);
            result = (await response.json()).data;
            assert.equal(result.status, "CANCELLED");
            assert.equal(result.offeredSharingSkills[0].id, offered.id);
          } finally {
            await app.close();
          }
        },
      );
    } finally {
      await f.dispose();
    }
  },
);
