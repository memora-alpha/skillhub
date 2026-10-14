import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { createSkillFixture } from "../skills/helpers.mjs";
import { IdentityConfig } from "../../dist/configs/identity.config.js";
import {
  adminAccountInputFromEnvironment,
  createAdminAccount,
  AdminAccountError,
} from "../../dist/modules/users/application/create-admin-account.js";

const password = "AdminTest123!";
const input = (email) => ({
  email,
  password,
  fullName: "Seed Admin",
  reason: "Create a test administrator",
});

test("Admin environment input validates credentials without including secrets in errors", () => {
  const env = {
    BOOTSTRAP_ADMIN_EMAIL: " SEED@Example.com ",
    BOOTSTRAP_ADMIN_PASSWORD: password,
  };
  const parsed = adminAccountInputFromEnvironment(env);
  assert.equal(parsed.email, "seed@example.com");
  assert.equal(parsed.fullName, "SkillHub Admin");
  assert.equal(parsed.password, password);
  const spaced = ` ${password} `;
  assert.equal(
    adminAccountInputFromEnvironment({
      ...env,
      BOOTSTRAP_ADMIN_PASSWORD: spaced,
    }).password,
    spaced,
  );
  assert.equal(
    adminAccountInputFromEnvironment({
      ...env,
      BOOTSTRAP_ADMIN_NAME: "",
      BOOTSTRAP_ADMIN_REASON: "",
    }).fullName,
    "SkillHub Admin",
  );
  for (const invalid of [
    {},
    { ...env, BOOTSTRAP_ADMIN_EMAIL: "bad-email" },
    { ...env, BOOTSTRAP_ADMIN_PASSWORD: "weak" },
    { ...env, BOOTSTRAP_ADMIN_NAME: "1234" },
    { ...env, BOOTSTRAP_ADMIN_REASON: "x".repeat(1001) },
  ]) {
    assert.throws(
      () => adminAccountInputFromEnvironment(invalid),
      (error) => {
        assert.ok(error instanceof AdminAccountError);
        assert.equal(error.message.includes(password), false);
        assert.equal(error.message.includes("bad-email"), false);
        return true;
      },
    );
  }
});

test(
  "Admin CLI rejects missing/invalid environment and argv credentials before database access",
  { timeout: 30000 },
  () => {
    for (const args of [[], ["--password", password]]) {
      const result = spawnSync(
        process.execPath,
        ["scripts/create-admin.mjs", ...args],
        {
          cwd: new URL("../../", import.meta.url),
          env: {
            ...process.env,
            DATABASE_URL: "postgresql://unreachable.invalid/test",
            BOOTSTRAP_ADMIN_EMAIL: "test@example.com",
            BOOTSTRAP_ADMIN_PASSWORD: "weak",
            NODE_ENV: "test",
          },
          encoding: "utf8",
          timeout: 10000,
        },
      );
      assert.equal(result.status, 1);
      assert.equal(result.stdout.includes(password), false);
      assert.equal(result.stderr.includes(password), false);
      assert.equal(result.stderr.includes("unreachable.invalid"), false);
      assert.match(
        result.stderr,
        /Password must contain|Run without arguments/u,
      );
    }
  },
);

test(
  "operator Admin account creation on PostgreSQL",
  { timeout: 120000 },
  async (t) => {
    const f = await createSkillFixture();
    const { users, audit } = f.identity;
    const config = f.identity.module.get(IdentityConfig);
    const create = (data, writer = audit) =>
      createAdminAccount(f.db, users, writer, config, data);
    try {
      await t.test(
        "creates a verified ACTIVE Admin, hashes the password, grants permissions and logs no secrets",
        async () => {
          const data = input(` Admin-${randomUUID()}@example.com `);
          const result = await create(data);
          const user = await f.db.user.findUniqueOrThrow({
            where: { id: result.userId },
            include: { roleIdRecord: true },
          });
          assert.equal(user.normalizedEmail, data.email.trim().toLowerCase());
          assert.equal(user.accountStatus, "ACTIVE");
          assert.equal(user.emailVerified, true);
          assert.equal(user.roleIdRecord.code, "ADMIN");
          assert.match(user.passwordHash, /^\$argon2id\$/u);
          assert.notEqual(user.passwordHash, password);
          const pair = await f.identity.auth.login(
            user.normalizedEmail,
            password,
          );
          const principal = await f.identity.sessions.principal(
            pair.accessToken,
          );
          assert.deepEqual(principal.roles, ["ADMIN"]);
          assert.ok(principal.permissions.includes("skill-level:manage"));
          const logs = await f.db.auditLog.findMany({
            where: { action: "ADMIN_BOOTSTRAP", targetId: user.id },
          });
          assert.equal(logs.length, 1);
          assert.equal(logs[0].reason, data.reason);
          const serialized = JSON.stringify(logs);
          assert.equal(serialized.includes(password), false);
          assert.equal(serialized.includes(user.passwordHash), false);
          assert.equal(serialized.includes(data.email), false);
          await assert.rejects(
            create({
              ...data,
              fullName: "Another Admin",
              password: "Changed123!",
            }),
            AdminAccountError,
          );
          const unchanged = await f.db.user.findUniqueOrThrow({
            where: { id: user.id },
          });
          assert.equal(unchanged.passwordHash, user.passwordHash);
          assert.equal(unchanged.fullName, user.fullName);
          assert.equal(
            await f.db.auditLog.count({
              where: { targetId: user.id, action: "ADMIN_BOOTSTRAP" },
            }),
            1,
          );
        },
      );
      await t.test(
        "refuses existing USER/locked accounts without promoting, unlocking or changing passwords",
        async () => {
          for (const locked of [false, true]) {
            const account = await f.account();
            if (locked)
              await f.db.user.update({
                where: { id: account.user.id },
                data: { accountStatus: "LOCKED" },
              });
            const before = await f.db.user.findUniqueOrThrow({
              where: { id: account.user.id },
            });
            await assert.rejects(
              create(input(account.user.normalizedEmail.toUpperCase())),
              AdminAccountError,
            );
            assert.deepEqual(
              await f.db.user.findUniqueOrThrow({
                where: { id: account.user.id },
              }),
              before,
            );
          }
        },
      );
      await t.test(
        "audit failure rolls back account creation and password persistence",
        async () => {
          const data = input(`${randomUUID()}@example.com`);
          await assert.rejects(
            create(data, {
              append: async () => {
                throw new Error("audit unavailable");
              },
            }),
            /audit unavailable/u,
          );
          assert.equal(
            await f.db.user.findUnique({
              where: { normalizedEmail: data.email },
            }),
            null,
          );
        },
      );
      await t.test(
        "two same-email requests produce one account and one audit record",
        async () => {
          const data = input(`${randomUUID()}@example.com`);
          const results = await Promise.allSettled([
            create(data),
            create({ ...data, email: data.email.toUpperCase() }),
          ]);
          const winner = results.find(
            (result) => result.status === "fulfilled",
          );
          assert.equal(
            results.filter((result) => result.status === "fulfilled").length,
            1,
          );
          assert.ok(
            results.find((result) => result.status === "rejected")
              .reason instanceof AdminAccountError,
          );
          assert.equal(
            await f.db.user.count({ where: { normalizedEmail: data.email } }),
            1,
          );
          assert.equal(
            await f.db.auditLog.count({
              where: {
                targetId: winner.value.userId,
                action: "ADMIN_BOOTSTRAP",
              },
            }),
            1,
          );
        },
      );
    } finally {
      await f.dispose();
    }
  },
);
