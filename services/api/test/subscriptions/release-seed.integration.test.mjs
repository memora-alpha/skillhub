// Spec 021: release seed `subscriptions-20261127` (identity + configuration) on an isolated schema.
import assert from "node:assert/strict";
import { test } from "node:test";
import { seedIdentity } from "../../dist/modules/users/application/bootstrap.js";
import { PrismaUsersRepository } from "../../dist/modules/users/infrastructure/persistence/prisma-users-repository.js";
import { seedApprovedConfigurations } from "../../dist/modules/system-configuration/application/seed-configuration.js";
import { ConfigurationRepository } from "../../dist/modules/system-configuration/infrastructure/persistence/configuration.repository.js";
import { DEFAULT_FREE_ENTITLEMENTS } from "../../dist/modules/subscriptions/domain/plan-entitlements.js";
import { createSkillFixture } from "../skills/helpers.mjs";

const rolePermissions = async (db, code) =>
  (
    await db.rolePermission.findMany({
      where: { roleIdRecord: { code } },
      include: { permissionIdRecord: true },
    })
  )
    .map((row) => row.permissionIdRecord.code)
    .filter((permission) => permission.startsWith("subscription:"))
    .sort((a, b) => a.localeCompare(b));

test("release seed subscriptions-20261127 on isolated PostgreSQL", async () => {
  const f = await createSkillFixture();
  try {
    const seed = async () => {
      await seedIdentity(f.db, new PrismaUsersRepository());
      await f.db.$transaction((tx) =>
        seedApprovedConfigurations(tx, new ConfigurationRepository(f.db)),
      );
    };
    // The release runner may repeat a request after a crash; both runs must agree.
    await seed();
    await seed();

    assert.deepEqual(await rolePermissions(f.db, "USER"), [
      "subscription:manage:self",
    ]);
    assert.deepEqual(await rolePermissions(f.db, "STAFF"), [
      "subscription:manage:self",
      "subscription:read",
    ]);
    assert.deepEqual(await rolePermissions(f.db, "ADMIN"), [
      "subscription:manage",
      "subscription:manage:self",
      "subscription:read",
    ]);

    const rows = await f.db.systemConfiguration.findMany({
      where: { key: { startsWith: "subscription." } },
    });
    const values = Object.fromEntries(rows.map((row) => [row.key, row.value]));
    // Ships dark: plans stay off until G3/G4 are cleared.
    assert.equal(values["subscription.enabled"], false);
    assert.deepEqual(values["subscription.recordingAddon"], {
      minutes: 60,
      priceCredit: 30,
    });
    assert.deepEqual(
      values["subscription.freeEntitlements"],
      DEFAULT_FREE_ENTITLEMENTS,
    );
    assert.equal(typeof values["subscription.graceDays"], "number");
    assert.equal(typeof values["subscription.renewalRetryHours"], "number");
  } finally {
    await f.dispose();
  }
});
