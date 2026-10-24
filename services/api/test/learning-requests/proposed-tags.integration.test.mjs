import assert from "node:assert/strict";
import { test } from "node:test";
import { createTagFixture } from "../tags/helpers.mjs";
import { LearningRequestAccessService } from "../../dist/modules/learning-requests/application/services/learning-request-access.service.js";
import { CreateLearningRequestUseCase } from "../../dist/modules/learning-requests/application/use-cases/create-learning-request.use-case.js";
import { PublishLearningRequestUseCase } from "../../dist/modules/learning-requests/application/use-cases/publish-learning-request.use-case.js";
import { ModerateLearningRequestUseCase } from "../../dist/modules/learning-requests/application/use-cases/moderate-learning-request.use-case.js";
import { ListLearningRequestsUseCase } from "../../dist/modules/learning-requests/application/use-cases/list-learning-requests.use-case.js";
import { PrismaLearningRequestRepository } from "../../dist/modules/learning-requests/infrastructure/persistence/prisma-learning-request.repository.js";
import { TagsRepository } from "../../dist/modules/skills/infrastructure/persistence/tags.repository.js";
import { LearningRequestTagsService } from "../../dist/modules/skills/application/services/learning-request-tags.service.js";
import { AuditWriter } from "../../dist/modules/audit/application/services/audit-writer.js";

test(
  "PostgreSQL post/tag review: visibility, concurrent canonicalization, version guards and rollback",
  {
    skip: !process.env.TEST_DATABASE_URL,
    timeout: 180000,
  },
  async (t) => {
    // createTagFixture creates a unique disposable schema, applies all migrations
    // there and drops it on dispose. No normal application tables are changed.
    const f = await createTagFixture();
    try {
      const admin = await f.account("ADMIN");
      const staff = await f.account("STAFF");
      const secondStaff = await f.account("STAFF");
      const owner = await f.account();
      const skill = await f.skills.create(f.command(admin), {
        name: "Inline tags learning skill",
        status: "ACTIVE",
      });
      const access = new LearningRequestAccessService(f.identity.sessions);
      const repository = new PrismaLearningRequestRepository(f.db);
      const configuration = {
        getSnapshot: async () => ({
          values: {
            "learningRequest.moderationRuleSet": {
              rules: [{ category: "BLOCKED", pattern: "prohibited" }],
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
      const publish = new PublishLearningRequestUseCase(
        f.transactions,
        access,
        f.actors,
        repository,
        f.skills,
        configuration,
        f.sharing,
      );
      const lists = new ListLearningRequestsUseCase(
        f.transactions,
        access,
        repository,
        f.skills,
        f.actors,
        f.sharing,
      );
      const tagRepository = new TagsRepository(f.db);
      const tags = new LearningRequestTagsService(
        tagRepository,
        f.actors,
        f.audit,
      );
      const review = (audit = f.audit) =>
        new ModerateLearningRequestUseCase(
          f.transactions,
          access,
          repository,
          audit,
          f.outbox,
          f.sharing,
          tags,
        );
      const post = async (proposedTags) => {
        const draft = await create.execute(owner.principal, {
          skillId: skill.id,
          title: "Learn programming through practical projects",
          description:
            "I want to learn programming with a teacher and build useful projects.",
          learningGoal: "Build a working application with a mentor.",
          proposedTags,
        });
        return publish.execute(owner.principal, draft.id, {
          expectedVersion: draft.version,
        });
      };
      const decide = (actor, post, decision = "APPROVE", useCase = review()) =>
        useCase.execute(
          actor.principal,
          post.id,
          decision,
          {
            expectedVersion: post.version,
            reason: "Reviewed the post and its proposed tags",
          },
          f.command(actor).context,
        );

      await t.test(
        "pending proposals appear to Staff, stay out of lookup/feed, then attach ACTIVE IDs",
        async () => {
          const pending = await post(["  Học   React  "]);
          assert.equal(pending.status, "PENDING_MODERATION");
          assert.equal(await f.db.tag.count(), 0);
          const queue = await lists.execute(staff.principal, "MODERATION", {});
          assert.deepEqual(
            queue.items.find((row) => row.id === pending.id).proposedTags,
            ["Học React"],
          );
          const feed = await lists.execute(owner.principal, "FEED", {});
          assert.ok(!feed.items.some((row) => row.id === pending.id));
          const approved = await decide(staff, pending);
          assert.equal(approved.status, "OPEN");
          assert.deepEqual(approved.proposedTags, []);
          const canonical = await f.db.tag.findUniqueOrThrow({
            where: { labelKey: "học react" },
          });
          assert.equal(canonical.status, "ACTIVE");
          assert.equal(canonical.createdByUserId, staff.user.id);
          assert.deepEqual(approved.tagIds, [canonical.id]);
          const lookup = await f.skills.listTags({ q: "Học React", limit: 20 });
          assert.ok(lookup.data.some((tag) => tag.id === canonical.id));
          const publicPost = (
            await lists.execute(owner.principal, "FEED", {})
          ).items.find((row) => row.id === pending.id);
          assert.deepEqual(publicPost.tags, [
            { id: canonical.id, label: "Học React" },
          ]);
          assert.equal(Object.hasOwn(publicPost, "proposedTags"), false);
        },
      );

      await t.test(
        "two posts reviewed concurrently reuse one normalized key and one TAG_CREATE audit",
        async () => {
          const a = await post(["Canonical concurrent tag"]);
          const b = await post(["CANONICAL CONCURRENT TAG"]);
          const results = await Promise.all([
            decide(staff, a),
            decide(secondStaff, b),
          ]);
          assert.deepEqual(results[0].tagIds, results[1].tagIds);
          const id = results[0].tagIds[0];
          assert.equal(
            await f.db.tag.count({
              where: { labelKey: "canonical concurrent tag" },
            }),
            1,
          );
          assert.equal(
            await f.db.auditLog.count({
              where: { action: "TAG_CREATE", targetId: id },
            }),
            1,
          );
        },
      );

      await t.test(
        "concurrent approve/reject commits only one decision for a post version",
        async () => {
          const pending = await post(["Competing post review"]);
          const raced = await Promise.allSettled([
            decide(staff, pending),
            decide(secondStaff, pending, "REJECT"),
          ]);
          assert.equal(
            raced.filter((result) => result.status === "fulfilled").length,
            1,
          );
          assert.equal(
            raced
              .find((result) => result.status === "rejected")
              .reason.getStatus(),
            409,
          );
          assert.equal(
            await f.db.auditLog.count({
              where: {
                action: "LEARNING_REQUEST_MODERATE",
                targetId: pending.id,
              },
            }),
            1,
          );
          const saved = await f.db.learningRequest.findUniqueOrThrow({
            where: { id: pending.id },
          });
          const count = await f.db.tag.count({
            where: { labelKey: "competing post review" },
          });
          assert.equal(count, saved.status === "OPEN" ? 1 : 0);
        },
      );

      await t.test(
        "rejection creates no tag; inactive canonical labels cannot be reactivated",
        async () => {
          const rejected = await decide(
            staff,
            await post(["Rejected post tag"]),
            "REJECT",
          );
          assert.deepEqual(rejected.proposedTags, ["Rejected post tag"]);
          assert.equal(
            await f.db.tag.count({ where: { labelKey: "rejected post tag" } }),
            0,
          );
          const inactive = await f.tags.create(f.command(admin), {
            label: "Unavailable inline tag",
          });
          await f.tags.update(f.command(admin), inactive.id, {
            expectedVersion: inactive.version,
            status: "INACTIVE",
            reason: "Not selectable",
          });
          const pending = await post([
            "First rollback tag",
            "Unavailable inline tag",
          ]);
          await assert.rejects(
            () => decide(staff, pending),
            (error) => error.message === "TAG_UNAVAILABLE",
          );
          assert.equal(
            await f.db.tag.count({ where: { labelKey: "first rollback tag" } }),
            0,
          );
          assert.equal(
            (
              await f.db.learningRequest.findUniqueOrThrow({
                where: { id: pending.id },
              })
            ).status,
            "PENDING_MODERATION",
          );
        },
      );

      await t.test(
        "post audit failure rolls back catalog insertion and tag links in PostgreSQL",
        async () => {
          const pending = await post(["Audit rollback tag"]);
          const failingAudit = new AuditWriter({
            append: async () => {
              throw new Error("post audit unavailable");
            },
          });
          await assert.rejects(
            () => decide(staff, pending, "APPROVE", review(failingAudit)),
            /post audit unavailable/,
          );
          assert.equal(
            await f.db.tag.count({ where: { labelKey: "audit rollback tag" } }),
            0,
          );
          assert.equal(
            await f.db.requestTag.count({ where: { requestId: pending.id } }),
            0,
          );
          assert.equal(
            (
              await f.db.learningRequest.findUniqueOrThrow({
                where: { id: pending.id },
              })
            ).status,
            "PENDING_MODERATION",
          );
        },
      );

      await t.test(
        "USER cannot review; database refuses OPEN with unreviewed labels",
        async () => {
          const pending = await post(["Authorization tag"]);
          await assert.rejects(
            () => decide(owner, pending),
            (error) => error.getStatus?.() === 403,
          );
          await assert.rejects(() =>
            f.db.learningRequest.update({
              where: { id: pending.id },
              data: { status: "OPEN" },
            }),
          );
          assert.equal(
            (
              await f.db.learningRequest.findUniqueOrThrow({
                where: { id: pending.id },
              })
            ).status,
            "PENDING_MODERATION",
          );
        },
      );
    } finally {
      await f.dispose();
    }
  },
);
