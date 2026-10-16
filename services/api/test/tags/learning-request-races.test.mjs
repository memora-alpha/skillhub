import { test } from "node:test";
import assert from "node:assert/strict";
import { createTagFixture } from "./helpers.mjs";
import { CreateLearningRequestUseCase } from "../../dist/modules/learning-requests/application/use-cases/create-learning-request.use-case.js";
import { EditLearningRequestUseCase } from "../../dist/modules/learning-requests/application/use-cases/edit-learning-request.use-case.js";
import { PublishLearningRequestUseCase } from "../../dist/modules/learning-requests/application/use-cases/publish-learning-request.use-case.js";
import { GetLearningRequestUseCase } from "../../dist/modules/learning-requests/application/use-cases/get-learning-request.use-case.js";
import { LearningRequestAccessService } from "../../dist/modules/learning-requests/application/services/learning-request-access.service.js";
import { PrismaLearningRequestRepository } from "../../dist/modules/learning-requests/infrastructure/persistence/prisma-learning-request.repository.js";

async function waitForBlocker(client, pid) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const result = await client.query(
      "SELECT EXISTS(SELECT FROM pg_stat_activity WHERE $1 = ANY(pg_blocking_pids(pid))) AS blocked",
      [pid],
    );
    if (result.rows[0].blocked) return true;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  return false;
}

for (const operation of ["create", "edit", "publish"]) {
  test(
    `real Learning Request ${operation} serializes both orders of a tag hide race`,
    { timeout: 120000 },
    async (t) => {
      const f = await createTagFixture();
      try {
        const admin = await f.account("ADMIN"),
          owner = await f.account(),
          viewer = await f.account();
        const skill = await f.skills.create(f.command(admin), {
          name: `Race skill ${operation}`,
          status: "ACTIVE",
        });
        const access = new LearningRequestAccessService(f.identity.sessions);
        const repository = new PrismaLearningRequestRepository(f.db);
        const configuration = {
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
          repository,
          f.sharing,
        );
        const get = new GetLearningRequestUseCase(
          f.transactions,
          access,
          repository,
          f.skills,
          f.actors,
          f.sharing,
        );
        for (const first of ["hide", "selection"]) {
          await t.test(`${first} commits first`, async () => {
            const tag = await f.tags.create(f.command(admin), {
              label: `${operation} ${first} race`,
            });
            const input = {
              skillId: skill.id,
              tagIds: [tag.id],
              title: "Learn safe concurrent updates",
              description:
                "Understand the ordering of concurrent learning request and tag changes.",
              learningGoal:
                "Apply transaction and catalog validation rules correctly.",
            };
            const draft =
              operation === "create"
                ? null
                : await create.execute(owner.principal, input);
            let signal, release;
            const ready = new Promise((resolve) => {
              signal = resolve;
            });
            const gate = new Promise((resolve) => {
              release = resolve;
            });
            let calls = 0;
            // Delegate every query and lock to the real owner. The gate controls only
            // when the final write transaction reaches its ACTIVE selection check.
            const catalog = {
              readSelections: (...args) => f.skills.readSelections(...args),
              assertActiveSelection: async (tx, selection) => {
                calls++;
                if (calls !== (operation === "create" ? 1 : 2))
                  return f.skills.assertActiveSelection(tx, selection);
                const [{ pid }] =
                  await tx.$queryRaw`SELECT pg_backend_pid() AS pid`;
                if (first === "hide") {
                  signal(pid);
                  await gate;
                  return f.skills.assertActiveSelection(tx, selection);
                }
                const result = await f.skills.assertActiveSelection(
                  tx,
                  selection,
                );
                signal(pid);
                await gate;
                return result;
              },
            };
            const run = () => {
              if (operation === "create")
                return new CreateLearningRequestUseCase(
                  f.transactions,
                  access,
                  f.actors,
                  catalog,
                  repository,
                  f.sharing,
                ).execute(owner.principal, input);
              if (operation === "edit")
                return new EditLearningRequestUseCase(
                  f.transactions,
                  access,
                  catalog,
                  repository,
                  configuration,
                  f.sharing,
                ).execute(owner.principal, draft.id, {
                  title: "Updated safe concurrent learning",
                  expectedVersion: draft.version,
                });
              return new PublishLearningRequestUseCase(
                f.transactions,
                access,
                f.actors,
                repository,
                catalog,
                configuration,
                f.sharing,
              ).execute(owner.principal, draft.id, {
                expectedVersion: draft.version,
              });
            };
            const result = run().then(
              (value) => ({ value }),
              (error) => ({ error }),
            );
            let hiding;
            try {
              const pid = await Promise.race([
                ready,
                result.then((outcome) => {
                  throw (
                    outcome.error ??
                    new Error("Learning Request completed before the race gate")
                  );
                }),
              ]);
              hiding = f.tags.update(f.command(admin), tag.id, {
                status: "INACTIVE",
                expectedVersion: 1,
                reason: "Hide during Learning Request mutation",
              });
              if (first === "hide") await hiding;
              else assert.equal(await waitForBlocker(f.client, pid), true);
              release();
              const outcome = await result;
              await hiding;
              if (first === "hide") {
                assert.equal(outcome.error?.getStatus(), 409);
                if (draft)
                  assert.equal(
                    (
                      await f.db.learningRequest.findUniqueOrThrow({
                        where: { id: draft.id },
                      })
                    ).version,
                    draft.version,
                  );
                else
                  assert.equal(
                    await f.db.requestTag.count({ where: { tagId: tag.id } }),
                    0,
                  );
              } else {
                assert.equal(outcome.error, undefined);
                assert.deepEqual(outcome.value.tagIds, [tag.id]);
                assert.equal(
                  await f.db.requestTag.count({
                    where: { requestId: outcome.value.id, tagId: tag.id },
                  }),
                  1,
                );
                const detail = await get.execute(
                  operation === "publish" ? viewer.principal : owner.principal,
                  outcome.value.id,
                );
                if (operation === "publish")
                  assert.deepEqual(detail.tags, [
                    { id: tag.id, label: tag.label },
                  ]);
                else assert.deepEqual(detail.tagIds, [tag.id]);
              }
            } finally {
              release();
              await result;
              await hiding?.catch(() => {});
            }
          });
        }
      } finally {
        await f.dispose();
      }
    },
  );
}
