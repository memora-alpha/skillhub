import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID, createHash } from "node:crypto";
import { Test } from "@nestjs/testing";
import { ValidationPipe, VersioningType } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { createSkillFixture } from "../skills/helpers.mjs";
import { VerificationAiService } from "../../dist/modules/verifications/application/services/verification-ai.service.js";
import { VerificationAiContext } from "../../dist/modules/verifications/application/services/verification-ai.context.js";
import { VerificationsService } from "../../dist/modules/verifications/application/services/verifications.service.js";
import { VerificationsRepository } from "../../dist/modules/verifications/infrastructure/persistence/verifications.repository.js";
import { VerificationAiRepository } from "../../dist/modules/verifications/infrastructure/persistence/verification-ai.repository.js";
import { VerificationAiPublisher } from "../../dist/modules/verifications/infrastructure/jobs/verification-ai.queue.js";
import { VerificationAiController } from "../../dist/modules/verifications/presentation/http/verification-ai.controller.js";
import { VerificationAiError } from "../../dist/modules/verifications/domain/verification-ai.config.js";
import { IdentityGuard } from "../../dist/shared/auth/identity.guard.js";
import { SessionsService } from "../../dist/modules/auth/application/services/sessions.service.js";
import { HttpExceptionFilter } from "../../dist/shared/http/http-exception.filter.js";
import { aiConfig, aiFileResult } from "./fixtures.mjs";

const status = (expected) => (error) => error.getStatus?.() === expected;
function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

test(
  "PostgreSQL submission, AI lifecycle, authorization, HTTP contract and recovery",
  {
    timeout: 180000,
    skip:
      !process.env.TEST_DATABASE_URL &&
      "Set TEST_DATABASE_URL to an isolated PostgreSQL test database",
  },
  async (t) => {
    const f = await createSkillFixture();
    let app;
    try {
      const owner = await f.account(),
        staff = await f.account("STAFF"),
        admin = await f.account("ADMIN");
      const repository = new VerificationAiRepository(f.db);
      const verifications = new VerificationsRepository(f.db);
      const context = new VerificationAiContext(
        verifications,
        f.sharing,
        f.identity.users,
      );
      let providerCalls = 0;
      let analyze = async (input) => ({
        result: aiFileResult(input.file),
        usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
      });
      const provider = {
        analyze: async (input) => {
          providerCalls++;
          return analyze(input);
        },
      };
      const service = new VerificationAiService(
        repository,
        verifications,
        context,
        f.sharing,
        f.actors,
        f.transactions,
        f.commands,
        f.storage,
        f.attachments,
        provider,
        f.outbox,
        f.audit,
        aiConfig,
      );
      const submission = new VerificationsService(
        verifications,
        f.sharing,
        f.actors,
        f.commands,
        f.transactions,
        f.storage,
        f.attachments,
        f.audit,
        f.outbox,
        service,
      );
      const pending = async (mimeType = "image/png") => {
        const skill = await f.skills.create(f.command(admin), {
          name: `AI ${randomUUID()}`,
          status: "ACTIVE",
        });
        const sharing = await f.sharing.create(f.command(owner), {
          skillId: skill.id,
          level: "INTERMEDIATE",
          description: "Teaching Chinese with several years of practice",
        });
        const bytes = Buffer.from("fixture evidence");
        const file = await f.readyFile(owner, {
          detectedMime: mimeType,
          sizeBytes: bytes.length,
          sha256: createHash("sha256").update(bytes).digest("hex"),
        });
        f.objects.set(file.objectKey, bytes);
        const command = f.command(owner);
        const verification = await submission.submit(command, sharing.id, {
          fileIds: [file.id],
        });
        const read = await service.read(staff.principal, verification.id);
        return { sharing, verification, file, run: read.latest, command };
      };

      const first = await pending();
      await t.test(
        "submission atomically creates snapshot, audit and reference-only outbox; replay and requests dedupe",
        async () => {
          assert.equal(first.run.status, "QUEUED");
          assert.equal(
            first.run.context.applicant.fullName,
            owner.user.fullName,
          );
          assert.equal(
            first.run.context.skill.sharingDescription,
            "Teaching Chinese with several years of practice",
          );
          const audit = await f.db.auditLog.findFirst({
            where: {
              action: "VERIFY_SKILL_AI_REQUEST",
              targetId: first.verification.id,
            },
          });
          assert.ok(audit);
          const event = await f.db.outboxEvent.findFirst({
            where: { type: "skill.verification.ai.requested" },
          });
          assert.deepEqual(event.payload, { analysisId: first.run.id });
          assert.equal(
            (
              await submission.submit(first.command, first.sharing.id, {
                fileIds: [first.file.id],
              })
            ).id,
            first.verification.id,
          );
          const requests = await Promise.all([
            service.request(f.command(staff), first.verification.id, 1),
            service.request(f.command(staff), first.verification.id, 1),
          ]);
          assert.ok(requests.every((run) => run.id === first.run.id));
          assert.equal(
            await f.db.verificationAiAnalysis.count({
              where: { verificationId: first.verification.id },
            }),
            1,
          );
          const jobCalls = [];
          const publisher = new VerificationAiPublisher(
            { add: async (...args) => jobCalls.push(args) },
            f.registry,
          );
          publisher.onModuleInit();
          await publisher.publish({ ...event, version: 1 });
          assert.equal(jobCalls[0][2].jobId, event.eventId);
          assert.equal(jobCalls[0][2].attempts, 3);
        },
      );

      await t.test(
        "one provider execution wins duplicate delivery and does not make a decision",
        async () => {
          const entered = deferred(),
            release = deferred();
          analyze = async (input) => {
            entered.resolve();
            await release.promise;
            return {
              result: aiFileResult(input.file),
              usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
            };
          };
          const work = service.process(first.run.id);
          await entered.promise;
          assert.equal(await service.process(first.run.id), "IGNORED");
          release.resolve();
          assert.equal(await work, "SUCCEEDED");
          const read = await service.read(
            staff.principal,
            first.verification.id,
          );
          assert.equal(
            read.latest.result.files[0].issuerVerification,
            "UNVERIFIED",
          );
          assert.equal(read.latest.isStale, false);
          assert.equal(
            (
              await f.db.skillVerification.findUnique({
                where: { id: first.verification.id },
              })
            ).status,
            "PENDING",
          );
          assert.equal(
            (await f.sharing.read(first.sharing.id)).verificationStatus,
            "PENDING",
          );
          const count = providerCalls;
          assert.equal(
            (await service.request(f.command(staff), first.verification.id, 1))
              .id,
            first.run.id,
          );
          assert.equal(await service.process(first.run.id), "IGNORED");
          assert.equal(providerCalls, count);
        },
      );

      await t.test(
        "profile changes invalidate analysis and permit a new bounded run",
        async () => {
          await f.identity.users.updateProfile(owner.user.id, {
            fullName: "Updated Fixture User",
          });
          assert.equal(
            (await service.read(staff.principal, first.verification.id)).latest
              .isStale,
            true,
          );
          const next = await service.request(
            f.command(staff),
            first.verification.id,
            1,
          );
          assert.notEqual(next.id, first.run.id);
          assert.equal(next.context.applicant.fullName, "Updated Fixture User");
        },
      );

      await t.test(
        "late results cannot overwrite staff decisions",
        async () => {
          const item = await pending();
          const entered = deferred(),
            release = deferred();
          analyze = async (input) => {
            entered.resolve();
            await release.promise;
            return {
              result: aiFileResult(input.file),
              usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
            };
          };
          const work = service.process(item.run.id);
          await entered.promise;
          await submission.decide(
            f.command(staff),
            item.verification.id,
            { expectedVersion: 1 },
            true,
          );
          release.resolve();
          assert.equal(await work, "STALE");
          assert.equal(
            (
              await f.db.skillVerification.findUnique({
                where: { id: item.verification.id },
              })
            ).status,
            "APPROVED",
          );
          assert.equal(
            (await f.sharing.read(item.sharing.id)).verificationStatus,
            "VERIFIED",
          );
          await assert.rejects(
            service.request(f.command(staff), item.verification.id, 2),
            status(409),
          );
        },
      );

      await t.test(
        "temporary provider failures stop after three attempts and manual runs have a cap",
        async () => {
          const item = await pending();
          analyze = async () => {
            throw new VerificationAiError("AI_PROVIDER_UNAVAILABLE", true);
          };
          await assert.rejects(
            service.process(item.run.id),
            /AI_RETRY_PENDING/,
          );
          await assert.rejects(
            service.process(item.run.id),
            /AI_RETRY_PENDING/,
          );
          assert.equal(await service.process(item.run.id), "FAILED");
          assert.equal((await repository.get(item.run.id)).attempts, 3);
          analyze = async () => {
            throw new VerificationAiError("AI_PROVIDER_AUTHENTICATION");
          };
          for (let i = 0; i < 2; i++) {
            const next = await service.request(
              f.command(staff),
              item.verification.id,
              1,
            );
            assert.equal(await service.process(next.id), "FAILED");
          }
          await assert.rejects(
            service.request(f.command(staff), item.verification.id, 1),
            /AI_RUN_LIMIT_REACHED/,
          );
          assert.equal(
            (
              await f.db.skillVerification.findUnique({
                where: { id: item.verification.id },
              })
            ).status,
            "PENDING",
          );
        },
      );

      await t.test(
        "expired leases are requeued atomically; expired workers cannot publish results",
        async () => {
          const item = await pending();
          const claim = await f.transactions.run((tx) =>
            repository.claim(tx, item.run.id, 5000),
          );
          await f.db.verificationAiAnalysis.update({
            where: { id: item.run.id },
            data: { leaseUntil: new Date(0) },
          });
          await service.recover();
          const recovered = await repository.get(item.run.id);
          assert.equal(recovered.status, "QUEUED");
          assert.equal(
            await f.transactions.run((tx) =>
              repository.finish(tx, item.run.id, claim.leaseToken, {
                status: "SUCCEEDED",
              }),
            ),
            false,
          );
          assert.ok(
            (await f.db.outboxEvent.count({
              where: {
                type: "skill.verification.ai.requested",
                payload: { path: ["analysisId"], equals: item.run.id },
              },
            })) >= 2,
          );
        },
      );

      await t.test(
        "unsupported DOC evidence retains manual flow without contacting provider",
        async () => {
          const count = providerCalls;
          const item = await pending("application/msword");
          assert.equal(item.run.status, "UNSUPPORTED");
          assert.equal(await service.process(item.run.id), "IGNORED");
          assert.equal(providerCalls, count);
        },
      );

      await t.test(
        "disabled integration leaves submission/manual decision available without provider access",
        async () => {
          const disabled = new VerificationAiService(
            repository,
            verifications,
            context,
            f.sharing,
            f.actors,
            f.transactions,
            f.commands,
            f.storage,
            f.attachments,
            provider,
            f.outbox,
            f.audit,
            { ...aiConfig, enabled: false },
          );
          const manual = new VerificationsService(
            verifications,
            f.sharing,
            f.actors,
            f.commands,
            f.transactions,
            f.storage,
            f.attachments,
            f.audit,
            f.outbox,
            disabled,
          );
          const skill = await f.skills.create(f.command(admin), {
            name: `Disabled ${randomUUID()}`,
            status: "ACTIVE",
          });
          const shared = await f.sharing.create(f.command(owner), {
            skillId: skill.id,
            level: "BEGINNER",
            description: "A manual verification with AI disabled",
          });
          const file = await f.readyFile(owner);
          const item = await manual.submit(f.command(owner), shared.id, {
            fileIds: [file.id],
          });
          assert.equal(
            (await disabled.read(staff.principal, item.id)).latest,
            null,
          );
          await assert.rejects(
            disabled.request(f.command(staff), item.id, 1),
            status(503),
          );
          await assert.rejects(
            disabled.request(f.command(owner), item.id, 1),
            status(403),
          );
          const calls = providerCalls;
          assert.equal(await disabled.process(first.run.id), "DISABLED");
          assert.equal(providerCalls, calls);
          assert.equal(
            (
              await manual.decide(
                f.command(staff),
                item.id,
                { expectedVersion: 1 },
                true,
              )
            ).status,
            "APPROVED",
          );
        },
      );

      await t.test(
        "changed file checksum or stale queued input never reaches provider",
        async () => {
          const item = await pending();
          const calls = providerCalls;
          f.objects.set(
            item.file.objectKey,
            Buffer.alloc(item.file.sizeBytes, 1),
          );
          await assert.rejects(
            service.process(item.run.id),
            /AI_RETRY_PENDING/,
          );
          assert.equal(providerCalls, calls);
          const other = await pending();
          await f.identity.users.updateProfile(owner.user.id, {
            fullName: "Another Fixture Name",
          });
          assert.equal(await service.process(other.run.id), "STALE");
          assert.equal(providerCalls, calls);
        },
      );

      await t.test(
        "snapshot, audit and outbox writes roll back with failed scheduling",
        async () => {
          const skill = await f.skills.create(f.command(admin), {
            name: `Rollback ${randomUUID()}`,
            status: "ACTIVE",
          });
          const shared = await f.sharing.create(f.command(owner), {
            skillId: skill.id,
            level: "BEGINNER",
            description: "A valid description for rollback testing",
          });
          const file = await f.readyFile(owner);
          const brokenAi = {
            schedule: async () => {
              throw new Error("fixture abort after submission writes");
            },
          };
          const broken = new VerificationsService(
            verifications,
            f.sharing,
            f.actors,
            f.commands,
            f.transactions,
            f.storage,
            f.attachments,
            f.audit,
            f.outbox,
            brokenAi,
          );
          await assert.rejects(
            broken.submit(f.command(owner), shared.id, { fileIds: [file.id] }),
            /fixture abort/,
          );
          assert.equal(
            await f.db.skillVerification.count({
              where: { sharingSkillId: shared.id },
            }),
            0,
          );
          assert.equal(
            (await f.db.storedFile.findUnique({ where: { id: file.id } }))
              .attachedAt,
            null,
          );
        },
      );

      await t.test(
        "actual HTTP guards, version/DTO/idempotency validation, private projections and Swagger",
        async () => {
          const module = await Test.createTestingModule({
            controllers: [VerificationAiController],
            providers: [
              { provide: VerificationAiService, useValue: service },
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
          const request = async (method, account, body, key = randomUUID()) => {
            const res = await fetch(
              `${base}/api/v1/staff/verifications/${first.verification.id}/ai-analysis`,
              {
                method,
                headers: {
                  ...(account
                    ? { Authorization: `Bearer ${account.token}` }
                    : {}),
                  ...(body
                    ? {
                        "Content-Type": "application/json",
                        ...(key ? { "Idempotency-Key": key } : {}),
                      }
                    : {}),
                },
                ...(body ? { body: JSON.stringify(body) } : {}),
              },
            );
            return { status: res.status, body: await res.json() };
          };
          assert.equal((await request("GET")).status, 401);
          assert.equal((await request("GET", owner)).status, 403);
          assert.equal(
            (await request("POST", owner, { expectedVersion: 1 })).status,
            403,
          );
          assert.equal((await request("GET", staff)).status, 200);
          assert.equal(
            (await request("POST", staff, { expectedVersion: 1 }, null)).status,
            400,
          );
          assert.equal(
            (
              await request("POST", staff, {
                expectedVersion: 1,
                model: "custom",
              })
            ).status,
            400,
          );
          assert.equal(
            (await request("POST", staff, { expectedVersion: 999 })).status,
            409,
          );
          const key = randomUUID();
          const accepted = await request(
            "POST",
            staff,
            { expectedVersion: 1 },
            key,
          );
          assert.equal(accepted.status, 202);
          assert.equal(
            (await request("POST", staff, { expectedVersion: 1 }, key)).body
              .data.id,
            accepted.body.data.id,
          );
          const data = JSON.stringify(accepted.body.data);
          assert.ok(
            !data.includes("storedFileId") &&
              !data.includes("storageKey") &&
              !data.includes("apiKey"),
          );
          const swagger = SwaggerModule.createDocument(
            app,
            new DocumentBuilder().setTitle("AI").build(),
          );
          assert.ok(
            swagger.paths[
              "/api/v1/staff/verifications/{verificationId}/ai-analysis"
            ].post.responses[202],
          );
          assert.deepEqual(
            swagger.components.schemas.AiFileResponse.properties
              .issuerVerification.enum,
            ["UNVERIFIED"],
          );
          assert.ok(
            swagger.components.schemas.AiFieldsResponse.properties
              .examinationDate,
          );
          const permission = await f.db.permission.findUnique({
            where: { code: "skill-verification:analyze" },
          });
          await f.db.rolePermission.deleteMany({
            where: { roleId: staff.user.roleId, permissionId: permission.id },
          });
          assert.equal(
            (await request("POST", staff, { expectedVersion: 1 }, key)).status,
            403,
          );
        },
      );
    } finally {
      await app?.close();
      await f.dispose();
    }
  },
);
