import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { createSkillFixture } from "../skills/helpers.mjs";
import { IdentityConfig } from "../../dist/configs/identity.config.js";
import { CreateStaffUseCase } from "../../dist/modules/users/application/use-cases/create-staff.use-case.js";
import { RegisterUseCase } from "../../dist/modules/auth/application/use-cases/register.use-case.js";
import { ReauthProofService } from "../../dist/modules/auth/application/services/reauth-proof.service.js";

if (!process.env.TEST_DATABASE_URL)
  throw new Error("TEST_DATABASE_URL is required");

test(
  "PostgreSQL direct staff creation, immediate login, concurrency and rollback",
  { timeout: 180000 },
  async (t) => {
    const f = await createSkillFixture();
    try {
      const module = f.identity.module;
      const config = module.get(IdentityConfig);
      const create = module.get(CreateStaffUseCase);
      const admin = await f.account("ADMIN");
      const password = "StaffPassword123!";
      const proof = async () => {
        const token = config.crypto.secret();
        await f.db.reauthProof.create({
          data: {
            userId: admin.principal.userId,
            sessionId: admin.principal.sessionId,
            securityVersion: admin.principal.securityVersion,
            purpose: "STAFF_ROLE_CHANGE",
            digest: config.crypto.secretDigest(token),
            expiresAt: new Date(Date.now() + 60000),
          },
        });
        return token;
      };
      const body = async (email, reauthToken) => ({
        email,
        fullName: "Staff Name",
        password,
        reauthToken: reauthToken ?? (await proof()),
      });

      await t.test(
        "direct create is ACTIVE STAFF and can log in immediately; duplicate registration is rejected",
        async () => {
          const { userId } = await create.execute(
            admin.principal,
            await body(" STAFF@Fixture.invalid "),
          );
          const user = await f.db.user.findUniqueOrThrow({
            where: { id: userId },
            include: { roleIdRecord: true },
          });
          assert.equal(user.normalizedEmail, "staff@fixture.invalid");
          assert.equal(user.roleIdRecord.code, "STAFF");
          assert.equal(user.accountStatus, "ACTIVE");
          assert.equal(user.emailVerified, true);
          const pair = await f.identity.auth.login(
            "staff@fixture.invalid",
            password,
          );
          const principal = await f.identity.sessions.principal(
            pair.accessToken,
          );
          assert.deepEqual(principal.roles, ["STAFF"]);
          const audit = await f.db.auditLog.findFirstOrThrow({
            where: { action: "STAFF_CREATED", targetId: userId },
          });
          assert.equal(audit.actorId, admin.principal.userId);
          assert.equal(audit.reason, null);
          assert.ok(!JSON.stringify(audit).includes(password));
          await assert.rejects(
            module.get(RegisterUseCase).execute({
              email: " STAFF@Fixture.invalid ",
              fullName: "Other Person",
              password,
            }),
            (e) => e.getStatus() === 409,
          );
        },
      );

      await t.test(
        "parallel normalized duplicate creates produce one account and one audit",
        async () => {
          const requests = await Promise.all([
            body("same@fixture.invalid"),
            body(" SAME@Fixture.invalid "),
          ]);
          const results = await Promise.allSettled(
            requests.map((data) => create.execute(admin.principal, data)),
          );
          assert.equal(
            results.filter((r) => r.status === "fulfilled").length,
            1,
          );
          assert.equal(
            await f.db.user.count({
              where: { normalizedEmail: "same@fixture.invalid" },
            }),
            1,
          );
          const user = await f.db.user.findUniqueOrThrow({
            where: { normalizedEmail: "same@fixture.invalid" },
          });
          assert.equal(
            await f.db.auditLog.count({
              where: { action: "STAFF_CREATED", targetId: user.id },
            }),
            1,
          );
        },
      );

      await t.test(
        "one reauth proof permits one creation across different emails",
        async () => {
          const token = await proof();
          const requests = await Promise.all([
            body("one@fixture.invalid", token),
            body("two@fixture.invalid", token),
          ]);
          const results = await Promise.allSettled(
            requests.map((data) => create.execute(admin.principal, data)),
          );
          assert.equal(
            results.filter((r) => r.status === "fulfilled").length,
            1,
          );
          assert.equal(
            await f.db.user.count({
              where: {
                normalizedEmail: {
                  in: ["one@fixture.invalid", "two@fixture.invalid"],
                },
              },
            }),
            1,
          );
        },
      );

      await t.test(
        "stale Admin claims cannot create an account after demotion",
        async () => {
          const demoted = await f.account("ADMIN");
          // Operator fixture change models an already-issued principal with stale grants.
          const userRole = await f.db.role.findUniqueOrThrow({
            where: { code: "USER" },
          });
          await f.db.user.update({
            where: { id: demoted.user.id },
            data: { roleId: userRole.id },
          });
          await assert.rejects(
            create.execute(
              demoted.principal,
              await body("denied@fixture.invalid"),
            ),
            (e) => e.getStatus() === 403,
          );
          assert.equal(
            await f.db.user.count({
              where: { normalizedEmail: "denied@fixture.invalid" },
            }),
            0,
          );
        },
      );

      await t.test(
        "audit failure rolls back user, role and proof; retry with same proof works",
        async () => {
          const token = await proof();
          const data = await body("rollback@fixture.invalid", token);
          const failing = new CreateStaffUseCase(
            f.db,
            config,
            f.identity.users,
            f.identity.sessions,
            module.get(ReauthProofService),
            {
              append: async () => {
                throw new Error("audit down");
              },
            },
          );
          await assert.rejects(
            failing.execute(admin.principal, data),
            /audit down/,
          );
          assert.equal(
            await f.db.user.count({ where: { normalizedEmail: data.email } }),
            0,
          );
          assert.equal(
            (
              await f.db.reauthProof.findUniqueOrThrow({
                where: { digest: config.crypto.secretDigest(token) },
              })
            ).consumedAt,
            null,
          );
          await create.execute(admin.principal, data);
        },
      );
    } finally {
      await f.dispose();
    }
  },
);
