import { createIdentityFixture } from "./fixture.mjs";
import { IdentityEmailWorker } from "../../dist/modules/notifications/infrastructure/jobs/identity-email.worker.js";
import { DeliverIdentityEmailUseCase } from "../../dist/modules/notifications/application/use-cases/deliver-identity-email.use-case.js";
import { BullIdentityEmailJobs } from "../../dist/modules/notifications/infrastructure/jobs/identity-email-jobs.js";
import { AvatarWorker } from "../../dist/modules/users/infrastructure/jobs/avatar.worker.js";
import { ProcessAvatarUseCase } from "../../dist/modules/users/application/use-cases/process-avatar.use-case.js";
import { BullAvatarJobs } from "../../dist/modules/users/infrastructure/jobs/avatar-jobs.js";
import { PrismaUsersRepository } from "../../dist/modules/users/infrastructure/persistence/prisma-users-repository.js";
import { lockUsers } from "../../dist/shared/database/identity-transactions.js";
import "reflect-metadata";
import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import pg from "pg";
import Redis from "ioredis";
import sharp from "sharp";
import { Queue, QueueEvents, Worker } from "bullmq";
import { redisConnectionOptions } from "../../dist/configs/redis.config.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { ValidationPipe, VersioningType } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { APP_GUARD } from "@nestjs/core";
import { PrismaClient } from "../../dist/generated/prisma/client.js";
import { IdentityConfig } from "../../dist/configs/identity.config.js";
import {
  seedIdentity,
  bootstrapAdmin,
} from "../../dist/modules/users/application/bootstrap.js";
import { IdentityGuard } from "../../dist/shared/auth/identity.guard.js";
import {
  IdentityThrottle,
  SharedRequestGuard,
} from "../../dist/shared/auth/identity-throttle.js";
import { AuthController } from "../../dist/modules/auth/presentation/http/auth.controller.js";
import { UsersController } from "../../dist/modules/users/presentation/http/users.controller.js";
import { AdministrationController } from "../../dist/modules/users/presentation/http/administration.controller.js";
import { HealthController } from "../../dist/health.controller.js";
import { HttpExceptionFilter } from "../../dist/shared/http/http-exception.filter.js";
import { PrismaService } from "../../dist/infrastructure/database/prisma.service.js";
import { RedisService } from "../../dist/infrastructure/cache/redis.service.js";
import { getConnectionToken } from "@nestjs/mongoose";

const fixtureEnvironment = () => ({
  NODE_ENV: "test",
  IDENTITY_JWT_KEY: randomBytes(48).toString("base64"),
  IDENTITY_OTP_KEY: randomBytes(32).toString("base64"),
  IDENTITY_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
  IDENTITY_KEY_ID: "fixture",
  IDENTITY_JWT_ISSUER: "identity-test",
  IDENTITY_JWT_AUDIENCE: "identity-test",
  IDENTITY_TERMS_VERSION: "fixture-v1",
  IDENTITY_DEFAULT_TIMEZONE: "Asia/Ho_Chi_Minh",
  IDENTITY_ACCESS_SECONDS: "300",
  IDENTITY_REFRESH_SECONDS: "3600",
  IDENTITY_REMEMBER_SECONDS: "7200",
  IDENTITY_RESET_SECONDS: "300",
  IDENTITY_REAUTH_SECONDS: "120",
  IDENTITY_THROTTLE_WINDOW_SECONDS: "60",
  IDENTITY_EMAIL_RATE_LIMIT: "1000",
  IDENTITY_IP_RATE_LIMIT: "1000",
  IDENTITY_DEVICE_RATE_LIMIT: "1000",
  IDENTITY_REQUEST_RATE_LIMIT: "1000",
  IDENTITY_DELIVERY_ATTEMPTS: "3",
  IDENTITY_DELIVERY_RETENTION_SECONDS: "86400",
  IDENTITY_NOTIFICATION_SECONDS: "3600",
  IDENTITY_AVATAR_RETENTION_SECONDS: "3600",
});

test(
  "real PostgreSQL/Redis identity journeys and concurrency",
  { timeout: 180000 },
  async (t) => {
    const schema = `identity_test_${randomUUID().replaceAll("-", "")}`;
    assert.match(schema, /^identity_test_[0-9a-f]{32}$/);
    const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
    const pool = new pg.Pool({
      connectionString: url,
      connectionTimeoutMillis: 5000,
    });
    const redis = new Redis(
      process.env.TEST_REDIS_URL ?? process.env.REDIS_URL,
      { lazyConnect: true, connectTimeout: 5000, retryStrategy: null },
    );
    redis.on("error", () => {});
    const identityEnvironment = fixtureEnvironment();
    const config = new IdentityConfig(new ConfigService(identityEnvironment));
    const db = new PrismaClient({
      adapter: new PrismaPg(
        {
          connectionString: url,
          connectionTimeoutMillis: 5000,
          options: `-c search_path=${schema}`,
        },
        { schema },
      ),
    });
    let app;
    let created = false;
    const objects = new Map();
    const queued = [];
    const sent = [];
    let scanResult = true;
    let scanFailure = false;
    let smtpFailure = false;
    const storage = {
      put: async (key, data) => {
        objects.set(key, Buffer.from(data));
      },
      read: async (key) => {
        if (!objects.has(key)) throw new Error("missing");
        return objects.get(key);
      },
      remove: async (key) => {
        objects.delete(key);
      },
      url: async (key) => `https://fixture.invalid/${key}?signed=true`,
    };
    const scanner = {
      scan: async () => {
        if (scanFailure) throw new Error("unavailable");
        return scanResult;
      },
    };
    const queue = {
      add: async (_name, data) => {
        queued.push(data);
      },
    };
    const smtp = {
      send: async (...args) => {
        if (smtpFailure) throw new Error("provider failure");
        sent.push(args);
        return args[0];
      },
    };
    try {
      await redis.connect();
      const client = await pool.connect();
      try {
        await client.query(`CREATE SCHEMA "${schema}"`);
        created = true;
        await client.query(`SET search_path TO "${schema}"`);
        for (const name of [
          "20261003000000_foundation",
          "20261003010000_identity",
          "20261005000000_sh005_consistency",
          // audit_logs columns added by SH-003; the generated client selects them.
          "20261005010000_sh003_audit",
          "20261005020000_sh006_configuration_history",
          "20261005030000_sh004_stored_files",
          "20261006000000_learning_requests",
          "20261007000000_runtime_v3",
          "20261007010000_skills",
        ])
          await client.query(
            await readFile(
              new URL(
                `../../prisma/migrations/${name}/migration.sql`,
                import.meta.url,
              ),
              "utf8",
            ),
          );
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
      await db.$connect();
      await seedIdentity(db, new PrismaUsersRepository());
      await seedIdentity(db, new PrismaUsersRepository());
      await t.test(
        "bulk seed is idempotent and preserves existing descriptions",
        async () => {
          await db.role.update({
            where: { code: "ADMIN" },
            data: { description: "operator description" },
          });
          await seedIdentity(db, new PrismaUsersRepository());
          assert.equal(await db.role.count(), 3);
          assert.equal(await db.permission.count(), 25);
          assert.equal(await db.rolePermission.count(), 39);
          assert.equal(
            (await db.role.findUniqueOrThrow({ where: { code: "ADMIN" } }))
              .description,
            "operator description",
          );
        },
      );
      await t.test(
        "bulk participant locks serialize reversed and duplicate UUID inputs",
        async () => {
          const ids = [randomUUID(), randomUUID()];
          const role = await db.role.findUniqueOrThrow({
            where: { code: "USER" },
          });
          await db.user.createMany({
            data: ids.map((id) => ({
              id,
              roleId: role.id,
              fullName: "Lock Fixture",
              accountStatus: "PENDING_VERIFICATION",
              emailVerified: false,
              securityVersion: 0,
              failedLoginCount: 0,
              locale: "vi",
              verifiedSkillCount: 0,
              completedSessionCount: 0,
              normalizedEmail: `${id}@lock.invalid`,
              termsVersion: "fixture",
              termsAcceptedAt: new Date(),
            })),
          });
          try {
            await lockUsers(db, []);
            await Promise.all(
              Array.from({ length: 8 }, (_, index) =>
                db.$transaction(
                  async (tx) => {
                    await tx.$executeRaw`SET LOCAL lock_timeout = '5s'`;
                    const ordered = index % 2 === 0 ? ids : [...ids].reverse();
                    await lockUsers(tx, [...ordered, ordered[0]]);
                    await tx.user.updateMany({
                      where: { id: { in: ids } },
                      data: { failedLoginCount: { increment: 1 } },
                    });
                  },
                  { timeout: 10000 },
                ),
              ),
            );
            const rows = await db.user.findMany({ where: { id: { in: ids } } });
            assert.equal(rows.length, 2);
            assert.ok(rows.every((row) => row.failedLoginCount === 8));
          } finally {
            await db.user.deleteMany({ where: { id: { in: ids } } });
          }
        },
      );
      const fixtures = [];
      const createFixture = async (options) => {
        const result = await createIdentityFixture(options);
        fixtures.push(result);
        return result;
      };
      t.after(async () => {
        for (const fixture of fixtures) await fixture.module.close();
      });
      const fixture = await createFixture({
        db,
        config,
        storage,
        scanner,
        smtp,
        queue,
      });
      const { users, audit, sessions, email, auth, admin, avatars } = fixture;
      const throttle = new IdentityThrottle(redis, config);
      const proof = async (address, purpose) => {
        const user = await db.user.findUniqueOrThrow({
          where: { normalizedEmail: address },
        });
        const challenge = await db.otpChallenge.findFirstOrThrow({
          where: {
            userId: user.id,
            purpose,
            consumedAt: null,
            supersededAt: null,
          },
          orderBy: { createdAt: "desc" },
        });
        const delivery = await db.identityEmailDelivery.findFirstOrThrow({
          where: { challengeId: challenge.id },
        });
        return {
          challenge,
          delivery,
          code: config.crypto.decrypt(
            delivery.encryptedPayload,
            `${delivery.id}:payload`,
          ),
        };
      };
      const signup = (address) =>
        auth.register({
          email: address,
          password: "Strong123!",
          fullName: "Nguyễn Hà",
        });
      const activate = async (address) => {
        await signup(address);
        await auth.verify(address, (await proof(address, "REGISTER")).code);
        return db.user.findUniqueOrThrow({
          where: { normalizedEmail: address },
        });
      };
      let user;
      let other;
      let actor;
      await t.test(
        "20 normalized signup races: one aggregate, immutable retry, encrypted durable intent",
        async () => {
          const results = await Promise.allSettled(
            Array.from({ length: 20 }, (_, index) =>
              signup(index % 2 ? " Race@Example.com " : "race@example.com"),
            ),
          );
          const rejected = results.find(
            (result) => result.status === "rejected",
          );
          if (rejected) throw rejected.reason;
          user = await db.user.findUniqueOrThrow({
            where: { normalizedEmail: "race@example.com" },
          });
          for (const table of [
            db.user,
            db.otpChallenge,
            db.identityEmailDelivery,
          ])
            assert.equal(await table.count(), 1);
          await auth.register({
            email: "RACE@example.com",
            password: "Replacement123!",
            fullName: "Other Name",
          });
          assert.equal(
            (await db.user.findUniqueOrThrow({ where: { id: user.id } }))
              .passwordHash,
            user.passwordHash,
          );
          assert.equal((await users.profile(user.id)).fullName, "Nguyễn Hà");
          await assert.rejects(
            auth.login("race@example.com", "Strong123!"),
            (error) => error.getStatus() === 403,
          );
          const p = await proof("race@example.com", "REGISTER");
          assert.ok(
            !Buffer.from(p.delivery.encryptedPayload).includes(
              Buffer.from(p.code),
            ),
          );
          await email.reconcile();
          assert.ok(queued.some((item) => item.id === p.delivery.id));
          assert.ok(queued.every((item) => Object.keys(item).length === 1));
        },
      );
      await t.test(
        "20 OTP consumes commit once; wrong attempts persist and cap at five",
        async () => {
          const p = await proof("race@example.com", "REGISTER");
          const results = await Promise.allSettled(
            Array.from({ length: 20 }, () =>
              auth.verify("race@example.com", p.code),
            ),
          );
          assert.equal(
            results.filter((result) => result.status === "fulfilled").length,
            1,
          );
          assert.equal(
            (await db.user.findUniqueOrThrow({ where: { id: user.id } }))
              .accountStatus,
            "ACTIVE",
          );
          await signup("attempt@example.com");
          const wrong = await proof("attempt@example.com", "REGISTER");
          await Promise.allSettled(
            Array.from({ length: 20 }, () =>
              auth.verify(
                "attempt@example.com",
                wrong.code === "000000" ? "999999" : "000000",
              ),
            ),
          );
          assert.equal(
            (
              await db.otpChallenge.findUniqueOrThrow({
                where: { id: wrong.challenge.id },
              })
            ).failedAttempts,
            5,
          );
          await assert.rejects(auth.verify("attempt@example.com", wrong.code));
          await email.deliver(wrong.delivery.id);
          assert.equal(
            (
              await db.identityEmailDelivery.findUniqueOrThrow({
                where: { id: wrong.delivery.id },
              })
            ).status,
            "CANCELLED",
          );
        },
      );
      await t.test(
        "resend cooldown, hourly cap and stale delivery cancellation",
        async () => {
          await signup("resend@example.com");
          const p = await proof("resend@example.com", "REGISTER");
          await Promise.all(
            Array.from({ length: 20 }, () =>
              auth.resend("resend@example.com", "REGISTER"),
            ),
          );
          assert.equal(
            await db.otpChallenge.count({
              where: { userId: p.challenge.userId },
            }),
            1,
          );
          for (let index = 0; index < 8; index++) {
            await db.otpIssueWindow.updateMany({
              where: { normalizedEmail: "resend@example.com" },
              data: { lastIssuedAt: new Date(Date.now() - 61000) },
            });
            await auth.resend("resend@example.com", "REGISTER");
          }
          assert.equal(
            await db.otpChallenge.count({
              where: { userId: p.challenge.userId },
            }),
            5,
          );
          await assert.rejects(auth.verify("resend@example.com", p.code));
          await email.deliver(p.delivery.id);
          assert.equal(
            (
              await db.identityEmailDelivery.findUniqueOrThrow({
                where: { id: p.delivery.id },
              })
            ).status,
            "CANCELLED",
          );
        },
      );
      await t.test(
        "login, refresh/replay race, current logout and logout-all enforce live sessions",
        async () => {
          await assert.rejects(
            auth.login("unknown@example.com", "Strong123!"),
            (error) => error.getStatus() === 401,
          );
          await assert.rejects(auth.login("race@example.com", "Wrong123!"));
          assert.equal(
            (await db.user.findUniqueOrThrow({ where: { id: user.id } }))
              .failedLoginCount,
            1,
          );
          const first = await auth.login("race@example.com", "Strong123!");
          const second = await auth.login(
            "race@example.com",
            "Strong123!",
            true,
          );
          assert.equal(
            (await db.user.findUniqueOrThrow({ where: { id: user.id } }))
              .failedLoginCount,
            0,
          );
          const rotated = await sessions.refresh(first.refreshToken);
          assert.equal(rotated.refreshExpiresAt, first.refreshExpiresAt);
          await assert.rejects(sessions.refresh(first.refreshToken));
          await assert.rejects(sessions.principal(rotated.accessToken));
          await sessions.principal(second.accessToken);
          const racing = await auth.login("race@example.com", "Strong123!");
          const results = await Promise.allSettled([
            sessions.refresh(racing.refreshToken),
            sessions.refresh(racing.refreshToken),
          ]);
          assert.equal(
            results.filter((result) => result.status === "fulfilled").length,
            1,
          );
          await assert.rejects(
            sessions.principal(
              results.find((result) => result.status === "fulfilled").value
                .accessToken,
            ),
          );
          await sessions.logout(second.refreshToken);
          await sessions.logout(second.refreshToken);
          await sessions.logout("invalid");
          await assert.rejects(sessions.principal(second.accessToken));
          const a = await auth.login("race@example.com", "Strong123!");
          const b = await auth.login("race@example.com", "Strong123!");
          await sessions.logoutAll(user.id);
          await assert.rejects(sessions.principal(a.accessToken));
          await assert.rejects(sessions.principal(b.accessToken));
        },
      );
      await t.test(
        "20 reset consumes: one change, all sessions revoked, status preserved, audit rollback",
        async () => {
          const a = await auth.login("race@example.com", "Strong123!");
          const b = await auth.login("race@example.com", "Strong123!");
          assert.deepEqual(
            await auth.resend("unknown@example.com", "RESET_PASSWORD"),
            await auth.resend("race@example.com", "RESET_PASSWORD"),
          );
          const p = await proof("race@example.com", "RESET_PASSWORD");
          const failed = (
            await createFixture({
              db,
              config,
              storage,
              scanner,
              smtp,
              queue,
              audit: {
                append: async () => {
                  throw new Error("audit unavailable");
                },
              },
            })
          ).auth;
          await assert.rejects(
            failed.reset("race@example.com", p.code, "NewStrong123!"),
          );
          assert.equal(
            (
              await db.otpChallenge.findUniqueOrThrow({
                where: { id: p.challenge.id },
              })
            ).consumedAt,
            null,
          );
          await sessions.principal(a.accessToken);
          const results = await Promise.allSettled(
            Array.from({ length: 20 }, () =>
              auth.reset("race@example.com", p.code, "NewStrong123!"),
            ),
          );
          assert.equal(
            results.filter((result) => result.status === "fulfilled").length,
            1,
          );
          await assert.rejects(sessions.principal(a.accessToken));
          await assert.rejects(sessions.principal(b.accessToken));
          await assert.rejects(auth.login("race@example.com", "Strong123!"));
          await auth.login("race@example.com", "NewStrong123!");
          assert.equal(
            await db.identityEmailDelivery.count({
              where: { userId: user.id, kind: "PASSWORD_CHANGED" },
            }),
            1,
          );
          await db.user.update({
            where: { id: user.id },
            data: { accountStatus: "LOCKED" },
          });
          await db.otpIssueWindow.updateMany({
            where: {
              normalizedEmail: "race@example.com",
              purpose: "RESET_PASSWORD",
            },
            data: { lastIssuedAt: new Date(Date.now() - 61000) },
          });
          await auth.resend("race@example.com", "RESET_PASSWORD");
          await auth.reset(
            "race@example.com",
            (await proof("race@example.com", "RESET_PASSWORD")).code,
            "Newest123!",
          );
          assert.equal(
            (await db.user.findUniqueOrThrow({ where: { id: user.id } }))
              .accountStatus,
            "LOCKED",
          );
          await assert.rejects(
            auth.login("race@example.com", "Newest123!"),
            (error) => error.getStatus() === 403,
          );
          await db.user.update({
            where: { id: user.id },
            data: { accountStatus: "ACTIVE" },
          });
        },
      );
      await t.test(
        "outbox expired lease recovery, restart, duplicate and bounded provider failures",
        async () => {
          other = await activate("other@example.com");
          await auth.resend("other@example.com", "RESET_PASSWORD");
          const p = await proof("other@example.com", "RESET_PASSWORD");
          await db.identityEmailDelivery.update({
            where: { id: p.delivery.id },
            data: { status: "LEASED", leaseUntil: new Date(Date.now() - 1000) },
          });
          await email.reconcile();
          assert.equal(
            (
              await db.identityEmailDelivery.findUniqueOrThrow({
                where: { id: p.delivery.id },
              })
            ).status,
            "PENDING",
          );
          const restart = (
            await createFixture({ db, config, storage, scanner, smtp, queue })
          ).email;
          await restart.deliver(p.delivery.id);
          await restart.deliver(p.delivery.id);
          assert.equal(
            sent.filter((args) => args[0] === p.delivery.id).length,
            1,
          );
          assert.equal(
            (
              await db.identityEmailDelivery.findUniqueOrThrow({
                where: { id: p.delivery.id },
              })
            ).encryptedPayload,
            null,
          );
          await signup("delivery@example.com");
          const failed = await proof("delivery@example.com", "REGISTER");
          smtpFailure = true;
          for (let i = 0; i < 3; i++) {
            await db.identityEmailDelivery.update({
              where: { id: failed.delivery.id },
              data: { nextAttemptAt: new Date(Date.now() - 1000) },
            });
            await email.deliver(failed.delivery.id);
          }
          smtpFailure = false;
          const row = await db.identityEmailDelivery.findUniqueOrThrow({
            where: { id: failed.delivery.id },
          });
          assert.equal(row.status, "FAILED");
          assert.equal(row.attempts, 3);
          assert.equal(row.encryptedPayload, null);
          assert.equal(row.lastErrorCode, "DELIVERY_FAILED");
        },
      );
      await t.test(
        "permission denials, bound one-use reauth, lock/unlock and audit rollback",
        async () => {
          const operator = await activate("operator@example.com");
          await bootstrapAdmin(
            db,
            users,
            audit,
            operator.id,
            "Fixture bootstrap",
          );
          actor = await sessions.principal(
            (await auth.login("operator@example.com", "Strong123!"))
              .accessToken,
          );
          const pair = await auth.login("other@example.com", "Strong123!");
          const target = await sessions.principal(pair.accessToken);
          const count = await db.auditLog.count();
          await assert.rejects(
            admin.status(target, user.id, true, "denied"),
            (error) => error.getStatus() === 403,
          );
          assert.equal(await db.auditLog.count(), count);
          const failing = (
            await createFixture({
              db,
              config,
              storage,
              scanner,
              smtp,
              queue,
              audit: {
                append: async () => {
                  throw new Error("audit failed");
                },
              },
            })
          ).admin;
          await assert.rejects(
            failing.status(actor, other.id, true, "rollback"),
          );
          assert.equal(
            (await db.user.findUniqueOrThrow({ where: { id: other.id } }))
              .accountStatus,
            "ACTIVE",
          );
          await sessions.principal(pair.accessToken);
          const p = await auth.reauthenticate(actor, "Strong123!");
          const another = await sessions.principal(
            (await auth.login("operator@example.com", "Strong123!"))
              .accessToken,
          );
          await assert.rejects(
            admin.staff(another, other.id, true, p.reauthToken, "wrong family"),
          );
          await admin.staff(actor, other.id, true, p.reauthToken, "grant");
          await assert.rejects(
            admin.staff(actor, other.id, false, p.reauthToken, "replay"),
          );
          const staff = await sessions.principal(pair.accessToken);
          assert.ok(staff.roles.includes("STAFF"));
          assert.ok(!staff.permissions.includes("users.lock"));
          await assert.rejects(
            admin.status(staff, user.id, true, "denied"),
            (error) => error.getStatus() === 403,
          );
          await admin.status(actor, other.id, true, "lock");
          await assert.rejects(sessions.principal(pair.accessToken));
          await admin.status(actor, other.id, false, "unlock");
          await assert.rejects(sessions.principal(pair.accessToken));
          await assert.rejects(
            admin.status(actor, other.id, false, "invalid"),
            (error) => error.getStatus() === 409,
          );
          await assert.rejects(
            db.auditLog.update({
              where: { id: (await db.auditLog.findFirstOrThrow()).id },
              data: { reason: "tamper" },
            }),
          );
          const list = await admin.list(actor, { limit: 1 });
          assert.ok(list.nextCursor);
          assert.ok(list.items[0].maskedEmail.includes("***"));
          await assert.rejects(
            admin.list(actor, { cursor: list.nextCursor, status: "LOCKED" }),
          );
        },
      );
      await t.test(
        "login/refresh versus lock cannot leave usable stale credentials; reauth rollback",
        async () => {
          const before = await auth.login("other@example.com", "Strong123!");
          const results = await Promise.allSettled([
            auth.login("other@example.com", "Strong123!"),
            sessions.refresh(before.refreshToken),
            admin.status(actor, other.id, true, "concurrent lock"),
          ]);
          assert.equal(results[2].status, "fulfilled");
          for (const result of results.slice(0, 2))
            if (result.status === "fulfilled")
              await assert.rejects(
                sessions.principal(result.value.accessToken),
              );
          await assert.rejects(sessions.principal(before.accessToken));
          await admin.status(actor, other.id, false, "restore fixture");
          const p = await auth.reauthenticate(actor, "Strong123!");
          const failed = (
            await createFixture({
              db,
              config,
              storage,
              scanner,
              smtp,
              queue,
              audit: {
                append: async () => {
                  throw new Error("audit fault");
                },
              },
            })
          ).admin;
          await assert.rejects(
            failed.staff(
              actor,
              other.id,
              false,
              p.reauthToken,
              "rollback removal",
            ),
          );
          assert.equal(
            (
              await db.reauthProof.findUniqueOrThrow({
                where: { digest: config.crypto.secretDigest(p.reauthToken) },
              })
            ).consumedAt,
            null,
          );
          await admin.staff(
            actor,
            other.id,
            false,
            p.reauthToken,
            "remove staff",
          );
        },
      );
      await t.test(
        "explicit delegated Staff grants are live; a stray assign grant never permits role management",
        async () => {
          const delegate = await activate("delegate@example.com");
          await db.$transaction((tx) =>
            users.role(tx, delegate.id, "STAFF", true, actor.userId),
          );
          const principal = await sessions.principal(
            (await auth.login("delegate@example.com", "Strong123!"))
              .accessToken,
          );
          await assert.rejects(
            admin.list(principal, {}),
            (error) => error.getStatus() === 403,
          );
          const role = await db.role.findUniqueOrThrow({
            where: { code: "STAFF" },
          });
          const originalGrants = await db.rolePermission.findMany({
            where: { roleId: role.id },
          });
          await db.rolePermission.createMany({
            data: (await db.permission.findMany()).map((permission) => ({
              roleId: role.id,
              permissionId: permission.id,
            })),
            skipDuplicates: true,
          });
          assert.ok((await admin.list(principal, {})).items.length > 0);
          await assert.rejects(
            admin.staff(principal, other.id, true, "invalid", "stray grant"),
            (error) => error.getStatus() === 403,
          );
          await admin.status(principal, other.id, true, "delegated lock");
          await admin.status(principal, other.id, false, "delegated unlock");
          await db.rolePermission.deleteMany({ where: { roleId: role.id } });
          await assert.rejects(
            admin.list(principal, {}),
            (error) => error.getStatus() === 403,
          );
          await db.rolePermission.createMany({
            data: originalGrants,
            skipDuplicates: true,
          });
        },
      );
      await t.test(
        "public allowlist, avatar ownership/quarantine and fault preservation",
        async () => {
          assert.deepEqual(
            Object.keys(await users.profile(user.id, true)).sort(),
            [
              "avatarUrl",
              "bio",
              "completedSessionCount",
              "fullName",
              "headline",
              "reputationScore",
              "userId",
              "verifiedSkillCount",
            ].sort(),
          );
          const bytes = await sharp({
            create: {
              width: 16,
              height: 16,
              channels: 3,
              background: "#112233",
            },
          })
            .png()
            .toBuffer();
          const file = {
            buffer: bytes,
            size: bytes.length,
            mimetype: "image/png",
          };
          const upload = await avatars.upload(user.id, file);
          assert.equal((await users.profile(user.id)).avatarUrl, null);
          await assert.rejects(
            avatars.status(other.id, upload.assetId),
            (error) => error.getStatus() === 404,
          );
          await avatars.process(upload.assetId);
          assert.equal(
            (await avatars.status(user.id, upload.assetId)).status,
            "CLEAN",
          );
          const old = (await users.profile(user.id)).avatarUrl;
          assert.match(old, /signed=true/);
          await assert.rejects(
            avatars.upload(user.id, { ...file, mimetype: "image/jpeg" }),
            (error) => error.getStatus() === 415,
          );
          await assert.rejects(
            avatars.upload(user.id, {
              buffer: Buffer.from("fake PNG"),
              size: 8,
              mimetype: "image/png",
            }),
          );
          const infected = await avatars.upload(user.id, file);
          scanResult = false;
          await avatars.process(infected.assetId);
          scanResult = true;
          assert.equal(
            (await avatars.status(user.id, infected.assetId)).status,
            "REJECTED",
          );
          assert.equal((await users.profile(user.id)).avatarUrl, old);
          const outage = await avatars.upload(user.id, file);
          scanFailure = true;
          await avatars.process(outage.assetId);
          scanFailure = false;
          assert.equal(
            (await avatars.status(user.id, outage.assetId)).status,
            "QUARANTINED",
          );
          assert.equal((await users.profile(user.id)).avatarUrl, old);
          await avatars.clear(user.id);
          await avatars.process(outage.assetId);
          await avatars.reconcile();
          assert.equal((await users.profile(user.id)).avatarUrl, null);
          assert.equal(objects.size, 0);
        },
      );
      await t.test(
        "21 versioned routes with Memora success/error/pagination envelopes and bodiless 204",
        async () => {
          const module = await Test.createTestingModule({
            controllers: [
              AuthController,
              UsersController,
              AdministrationController,
              HealthController,
            ],
            providers: [
              ...fixture.providers,
              { provide: IdentityThrottle, useValue: throttle },
              IdentityGuard,
              SharedRequestGuard,
              { provide: APP_GUARD, useExisting: SharedRequestGuard },
              { provide: PrismaService, useValue: db },
              { provide: RedisService, useValue: redis },
              {
                provide: getConnectionToken(),
                useValue: {
                  db: { admin: () => ({ ping: async () => ({ ok: 1 }) }) },
                },
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
          const request = (path, method = "GET", body, token) =>
            fetch(`${base}${path}`, {
              method,
              headers: {
                ...(body ? { "Content-Type": "application/json" } : {}),
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
              body: body ? JSON.stringify(body) : undefined,
            });
          const document = SwaggerModule.createDocument(
            app,
            new DocumentBuilder().addBearerAuth().build(),
          );
          assert.equal(
            Object.entries(document.paths)
              .filter(([path]) => path.startsWith("/api/v1/"))
              .reduce(
                (sum, [, methods]) =>
                  sum +
                  Object.keys(methods).filter((method) =>
                    ["get", "post", "patch", "put", "delete"].includes(method),
                  ).length,
                0,
              ),
            21,
          );
          assert.ok(document.paths["/api/health"]);
          assert.ok(!document.paths["/api/v1/health"]);
          for (const methods of Object.values(document.paths)) {
            for (const operation of Object.values(methods)) {
              for (const [status, response] of Object.entries(
                operation.responses,
              )) {
                if (status === "204") {
                  assert.equal(response.content, undefined);
                  continue;
                }
                const schema = response.content["application/json"].schema;
                assert.equal(schema.properties.message.type, "string");
                if (Number(status) >= 400) {
                  assert.deepEqual(schema.properties.success.enum, [false]);
                  assert.deepEqual(schema.properties.statusCode.enum, [
                    Number(status),
                  ]);
                } else {
                  assert.deepEqual(schema.properties.success.enum, [true]);
                  assert.ok(schema.required.includes("data"));
                }
              }
            }
          }
          assert.equal(
            document.paths["/api/v1/auth/login"].post.responses[200].content[
              "application/json"
            ].schema.properties.data.$ref,
            "#/components/schemas/TokenPairDto",
          );
          assert.equal(
            document.paths["/api/v1/admin/users"].get.responses[200].content[
              "application/json"
            ].schema.properties.data.items.$ref,
            "#/components/schemas/AdminUserResponse",
          );
          const readSuccess = async (response, status = 200) => {
            assert.equal(response.status, status);
            const body = await response.json();
            assert.equal(body.success, true);
            assert.equal(typeof body.message, "string");
            assert.ok(body.message.length > 0);
            assert.ok("data" in body);
            assert.ok(!("error" in body));
            return body;
          };
          const readError = async (response, status) => {
            assert.equal(response.status, status);
            const body = await response.json();
            assert.equal(body.success, false);
            assert.equal(body.statusCode, status);
            assert.equal(typeof body.message, "string");
            assert.ok(!("data" in body));
            assert.ok(!("error" in body));
            return body;
          };
          assert.deepEqual(
            (await readSuccess(await request("/api/health"))).data,
            { status: "ok", service: "skillhub-api" },
          );
          assert.deepEqual(
            (await readSuccess(await request("/api/health/ready"))).data,
            { status: "ok", dependencies: ["postgresql", "mongodb", "redis"] },
          );
          for (const path of ["/api/auth/login", "/api/v2/auth/login"])
            await readError(
              await request(path, "POST", {
                email: "race@example.com",
                password: "Newest123!",
              }),
              404,
            );
          const invalid = await readError(
            await request("/api/v1/auth/register", "POST", {
              email: "a@example.com",
              password: "Strong123!",
              confirmPassword: "Strong123!",
              fullName: "Good Name",
              agreeTerms: true,
              roles: ["ADMIN"],
            }),
            400,
          );
          assert.match(invalid.message, /roles/);
          for (const path of ["verification/resend", "password/forgot"]) {
            const acknowledgement = await readSuccess(
              await request(`/api/v1/auth/${path}`, "POST", {
                email: "absent@example.com",
              }),
              202,
            );
            assert.equal(acknowledgement.data, null);
          }
          const registration = await readSuccess(
            await request("/api/v1/auth/register", "POST", {
              email: "http@example.com",
              password: "Strong123!",
              confirmPassword: "Strong123!",
              fullName: "HTTP User",
              agreeTerms: true,
            }),
            202,
          );
          assert.equal(registration.data, null);
          const duplicate = await readSuccess(
            await request("/api/v1/auth/register", "POST", {
              email: "http@example.com",
              password: "Strong123!",
              confirmPassword: "Strong123!",
              fullName: "HTTP User",
              agreeTerms: true,
            }),
            202,
          );
          assert.deepEqual(duplicate, registration);
          const verification = await request(
            "/api/v1/auth/verification/verify",
            "POST",
            {
              email: "http@example.com",
              otpCode: (await proof("http@example.com", "REGISTER")).code,
            },
          );
          assert.equal(verification.status, 204);
          assert.equal(await verification.text(), "");
          const login = await request("/api/v1/auth/login", "POST", {
            email: " RACE@Example.com ",
            password: "Newest123!",
          });
          assert.equal(login.status, 200);
          assert.equal(login.headers.get("cache-control"), "no-store");
          let pair = (await readSuccess(login)).data;
          await readError(await request("/api/v1/me"), 401);
          const own = await readSuccess(
            await request("/api/v1/me", "GET", undefined, pair.accessToken),
          );
          assert.equal(own.data.email, "race@example.com");
          assert.ok(!("passwordHash" in own.data));
          for (const body of [{ reputationScore: 100 }, {}])
            assert.equal(
              (
                await request(
                  "/api/v1/me/profile",
                  "PATCH",
                  body,
                  pair.accessToken,
                )
              ).status,
              400,
            );
          await readError(
            await request(
              "/api/v1/admin/users",
              "GET",
              undefined,
              pair.accessToken,
            ),
            403,
          );
          const profile = await readSuccess(
            await request(
              "/api/v1/me/profile",
              "PATCH",
              { bio: "<script>plain text</script>" },
              pair.accessToken,
            ),
          );
          assert.equal(profile.data.bio, "<script>plain text</script>");
          const projection = (
            await readSuccess(
              await request(
                `/api/v1/profiles/${user.id}`,
                "GET",
                undefined,
                pair.accessToken,
              ),
            )
          ).data;
          assert.ok(!JSON.stringify(projection).includes("race@example.com"));
          assert.ok(!("roles" in projection));
          const bytes = await sharp({
            create: {
              width: 16,
              height: 16,
              channels: 3,
              background: "#112233",
            },
          })
            .png()
            .toBuffer();
          const form = new FormData();
          form.append(
            "image",
            new Blob([bytes], { type: "image/png" }),
            "avatar.png",
          );
          const avatar = await readSuccess(
            await fetch(`${base}/api/v1/me/avatar`, {
              method: "POST",
              headers: { Authorization: `Bearer ${pair.accessToken}` },
              body: form,
            }),
            202,
          );
          assert.equal(avatar.data.status, "QUARANTINED");
          const uploadStatus = await readSuccess(
            await request(
              `/api/v1/me/avatar/uploads/${avatar.data.assetId}`,
              "GET",
              undefined,
              pair.accessToken,
            ),
          );
          assert.equal(uploadStatus.data.assetId, avatar.data.assetId);
          const clearAvatar = await request(
            "/api/v1/me/avatar",
            "DELETE",
            undefined,
            pair.accessToken,
          );
          assert.equal(clearAvatar.status, 204);
          assert.equal(await clearAvatar.text(), "");
          const operator = (
            await readSuccess(
              await request("/api/v1/auth/login", "POST", {
                email: "operator@example.com",
                password: "Strong123!",
              }),
            )
          ).data;
          const reauthResponse = await request(
            "/api/v1/auth/reauthenticate",
            "POST",
            {
              password: "Strong123!",
              purpose: "STAFF_ROLE_CHANGE",
            },
            operator.accessToken,
          );
          assert.equal(reauthResponse.headers.get("cache-control"), "no-store");
          assert.ok((await readSuccess(reauthResponse)).data.reauthToken);
          const firstPage = await readSuccess(
            await request(
              "/api/v1/admin/users?limit=1",
              "GET",
              undefined,
              operator.accessToken,
            ),
          );
          assert.equal(firstPage.data.length, 1);
          assert.match(firstPage.data[0].maskedEmail, /\*\*\*/);
          assert.ok(!("email" in firstPage.data[0]));
          assert.equal(firstPage.meta.pagination.hasMore, true);
          assert.equal(firstPage.meta.pagination.limit, 1);
          const nextPage = await readSuccess(
            await request(
              `/api/v1/admin/users?limit=1&cursor=${encodeURIComponent(firstPage.meta.pagination.nextCursor)}`,
              "GET",
              undefined,
              operator.accessToken,
            ),
          );
          assert.notEqual(nextPage.data[0].userId, firstPage.data[0].userId);
          const finalPage = await readSuccess(
            await request(
              "/api/v1/admin/users?limit=100",
              "GET",
              undefined,
              operator.accessToken,
            ),
          );
          assert.equal(finalPage.meta.pagination.nextCursor, null);
          assert.equal(finalPage.meta.pagination.hasMore, false);
          const refreshed = await request("/api/v1/auth/refresh", "POST", {
            refreshToken: pair.refreshToken,
          });
          assert.equal(refreshed.headers.get("cache-control"), "no-store");
          pair = (await readSuccess(refreshed)).data;
          const logout = await request("/api/v1/auth/logout", "POST", {
            refreshToken: pair.refreshToken,
          });
          assert.equal(logout.status, 204);
          assert.equal(await logout.text(), "");
          assert.equal(
            (await request("/api/v1/me", "GET", undefined, pair.accessToken))
              .status,
            401,
          );
        },
      );
      await t.test(
        "previous key ring preserves pending OTP and encrypted delivery across rotation",
        async () => {
          await signup("rotation@example.com");
          const p = await proof("rotation@example.com", "REGISTER");
          const rotated = new IdentityConfig(
            new ConfigService({
              ...identityEnvironment,
              IDENTITY_KEY_ID: "rotated",
              IDENTITY_OTP_KEY: randomBytes(32).toString("base64"),
              IDENTITY_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
              IDENTITY_PREVIOUS_KEYS: JSON.stringify({
                fixture: {
                  otpKey: identityEnvironment.IDENTITY_OTP_KEY,
                  encryptionKey: identityEnvironment.IDENTITY_ENCRYPTION_KEY,
                },
              }),
            }),
          );
          const sender = (
            await createFixture({
              db,
              config: rotated,
              storage,
              scanner,
              smtp,
              queue,
            })
          ).email;
          await sender.deliver(p.delivery.id);
          assert.ok(
            sent.some(
              (args) => args[0] === p.delivery.id && args[3] === p.code,
            ),
          );
          const rotatedAuth = (
            await createFixture({
              db,
              config: rotated,
              storage,
              scanner,
              smtp,
              queue,
            })
          ).auth;
          await rotatedAuth.verify("rotation@example.com", p.code);
          assert.equal(
            (
              await db.user.findUniqueOrThrow({
                where: { id: p.challenge.userId },
              })
            ).accountStatus,
            "ACTIVE",
          );
        },
      );
      await t.test(
        "real BullMQ workers process committed email and avatar IDs",
        async () => {
          await signup("queue@example.com");
          const p = await proof("queue@example.com", "REGISTER");
          const name = "identity-fixture";
          const connection = {
            ...redisConnectionOptions(
              process.env.TEST_REDIS_URL ?? process.env.REDIS_URL,
            ),
            maxRetriesPerRequest: null,
          };
          const liveQueue = new Queue(name, { connection, prefix: schema });
          const events = new QueueEvents(name, { connection, prefix: schema });
          await liveQueue.pause();
          const processor = new IdentityEmailWorker(
            fixture.module.get(DeliverIdentityEmailUseCase),
          );
          const dispatcher = new BullIdentityEmailJobs(liveQueue);
          const worker = new Worker(name, (job) => processor.process(job), {
            connection,
            prefix: schema,
          });
          try {
            await events.waitUntilReady();
            await worker.waitUntilReady();
            await dispatcher.enqueue(p.delivery.id, 0);
            const job = await liveQueue.getJob(`${p.delivery.id}-0`);
            assert.ok(job);
            assert.deepEqual(job.data, { id: p.delivery.id });
            await liveQueue.resume();
            await job.waitUntilFinished(events, 10000);
            assert.equal(
              (
                await db.identityEmailDelivery.findUniqueOrThrow({
                  where: { id: p.delivery.id },
                })
              ).status,
              "SENT",
            );
            assert.ok(sent.some((args) => args[0] === p.delivery.id));

            await auth.verify("queue@example.com", p.code);
            const queueUser = await db.user.findUniqueOrThrow({
              where: { normalizedEmail: "queue@example.com" },
            });
            const bytes = await sharp({
              create: { width: 2, height: 2, channels: 3, background: "red" },
            })
              .png()
              .toBuffer();
            const upload = await avatars.upload(queueUser.id, {
              buffer: bytes,
              mimetype: "image/png",
              size: bytes.length,
            });
            const avatarName = `${name}-avatar`;
            const avatarQueue = new Queue(avatarName, {
              connection,
              prefix: schema,
            });
            const avatarEvents = new QueueEvents(avatarName, {
              connection,
              prefix: schema,
            });
            const avatarProcessor = new AvatarWorker(
              fixture.module.get(ProcessAvatarUseCase),
            );
            await avatarQueue.pause();
            const avatarWorker = new Worker(
              avatarName,
              (job) => avatarProcessor.process(job),
              {
                connection,
                prefix: schema,
              },
            );
            try {
              await avatarEvents.waitUntilReady();
              await avatarWorker.waitUntilReady();
              await new BullAvatarJobs(avatarQueue).enqueue(upload.assetId);
              const [avatarJob] = await avatarQueue.getWaiting();
              assert.ok(avatarJob);
              assert.deepEqual(avatarJob.data, { id: upload.assetId });
              await avatarQueue.resume();
              await avatarJob.waitUntilFinished(avatarEvents, 10000);
              assert.equal(
                (await avatars.status(queueUser.id, upload.assetId)).status,
                "CLEAN",
              );
              assert.equal(
                (
                  await db.user.findUniqueOrThrow({
                    where: { id: queueUser.id },
                  })
                ).avatarAssetId,
                upload.assetId,
              );
            } finally {
              await avatarWorker.close();
              await avatarEvents.close();
              await avatarQueue.obliterate();
              await avatarQueue.close();
            }
          } finally {
            await worker.close();
            await events.close();
            await liveQueue.obliterate();
            await liveQueue.close();
          }
        },
      );
      await t.test(
        "shared Redis counters and storage outage fail closed",
        async () => {
          config.emailLimit = 1;
          await throttle.check(
            "fixture-rate",
            "rate@example.com",
            "fixture-ip",
            "fixture-device",
          );
          await assert.rejects(
            new IdentityThrottle(redis, config).check(
              "fixture-rate",
              "rate@example.com",
              "fixture-ip",
              "fixture-device",
            ),
            (error) => error.getStatus() === 429,
          );
          await assert.rejects(
            new IdentityThrottle(
              {
                eval: async () => {
                  throw new Error("down");
                },
              },
              config,
            ).check("test", "a", "b", "c"),
            (error) => error.getStatus() === 503,
          );
        },
      );
    } finally {
      if (app) await app.close();
      await db.$disconnect();
      if (created) {
        await pool.query(`DROP SCHEMA IF EXISTS "${schema}_legacy_v3" CASCADE`);
        await pool.query(`DROP SCHEMA "${schema}" CASCADE`);
      }
      await pool.end();
      redis.disconnect(); // Random-key HMAC Redis keys expire in 60 seconds.
    }
  },
);
