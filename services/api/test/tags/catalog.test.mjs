import { test } from "node:test";
import assert from "node:assert/strict";
import { createTagFixture, status } from "./helpers.mjs";
import { PrismaUsersRepository } from "../../dist/modules/users/infrastructure/persistence/prisma-users-repository.js";

test(
  "catalog requires ADMIN and explicit permission; canonical writes are versioned and idempotent",
  { timeout: 120000 },
  async () => {
    const f = await createTagFixture();
    try {
      const admin = await f.account("ADMIN"),
        staff = await f.account("STAFF"),
        user = await f.account();
      const count = await f.db.rolePermission.count();
      await f.db.$transaction((tx) =>
        new PrismaUsersRepository().seedRoles(tx),
      );
      assert.equal(await f.db.rolePermission.count(), count);
      for (const actor of [staff, user])
        await assert.rejects(
          f.tags.create(f.command(actor), { label: "Node" }),
          status(403),
        );
      const staffRole = await f.db.role.findUniqueOrThrow({
        where: { code: "STAFF" },
      });
      const permission = await f.db.permission.findUniqueOrThrow({
        where: { code: "tag:create" },
      });
      await f.db.rolePermission.create({
        data: { roleId: staffRole.id, permissionId: permission.id },
      });
      await assert.rejects(
        f.tags.create(f.command(staff), { label: "Node" }),
        status(403),
      );
      const cmd = f.command(admin);
      const tag = await f.tags.create(cmd, { label: "  Node  JS " });
      assert.equal(tag.label, "Node JS");
      assert.equal(tag.createdByUserId, admin.user.id);
      assert.equal(tag.status, "ACTIVE");
      assert.equal(
        (await f.tags.create(cmd, { label: "  Node  JS " })).id,
        tag.id,
      );
      assert.equal(
        await f.db.auditLog.count({ where: { targetId: tag.id } }),
        1,
      );
      await assert.rejects(
        f.tags.create(f.command(admin), { label: "node js" }),
        status(409),
      );
      const other = await f.tags.create(f.command(admin), {
        label: "Other tag",
      });
      await assert.rejects(
        f.tags.update(f.command(admin), other.id, {
          label: "NODE JS",
          expectedVersion: 1,
          reason: "Duplicate rename",
        }),
        status(409),
      );
      await f.db.tag.update({
        where: { id: other.id },
        data: { status: "ARCHIVED" },
      });
      await assert.rejects(
        f.tags.update(f.command(admin), other.id, {
          status: "ACTIVE",
          expectedVersion: 1,
          reason: "No implicit restore",
        }),
        status(409),
      );
      const hidden = await f.tags.update(f.command(admin), tag.id, {
        status: "INACTIVE",
        expectedVersion: 1,
        reason: "Hide duplicate concept",
      });
      assert.equal(hidden.version, 2);
      await assert.rejects(
        f.tags.update(f.command(admin), tag.id, {
          status: "ACTIVE",
          expectedVersion: 1,
          reason: "Stale edit",
        }),
        status(409),
      );
      assert.equal((await f.skills.listTags({ limit: 20 })).data.length, 0);
      assert.ok(
        (await f.tags.adminList(f.command(admin), { limit: 20 })).data.some(
          (row) => row.id === tag.id,
        ),
      );
      await f.db.rolePermission.deleteMany({
        where: { roleId: admin.user.roleId, permissionId: permission.id },
      });
      await assert.rejects(
        f.tags.create(cmd, { label: "  Node  JS " }),
        status(403),
      );
      const liveAdmin = await f.account("ADMIN");
      const updateCommand = f.command(liveAdmin);
      const input = {
        status: "ACTIVE",
        expectedVersion: 2,
        reason: "Restore visibility",
      };
      await f.tags.update(updateCommand, tag.id, input);
      const userRole = await f.db.role.findUniqueOrThrow({
        where: { code: "USER" },
      });
      await f.db.user.update({
        where: { id: liveAdmin.user.id },
        data: { roleId: userRole.id },
      });
      await assert.rejects(
        f.tags.update(updateCommand, tag.id, input),
        status(403),
      );
    } finally {
      await f.dispose();
    }
  },
);

test(
  "tag selection holds a shared lock until commit while hide waits; historical links remain readable",
  { timeout: 120000 },
  async () => {
    const f = await createTagFixture();
    let unlock;
    let selection;
    try {
      const admin = await f.account("ADMIN");
      const tag = await f.tags.create(f.command(admin), {
        label: "Lock ordering",
      });
      const skill = await f.skills.create(f.command(admin), {
        name: "Lock skill",
        status: "ACTIVE",
      });
      let signal;
      const selected = new Promise((resolve) => {
        signal = resolve;
      });
      const gate = new Promise((resolve) => {
        unlock = resolve;
      });
      selection = f.transactions.run(async (tx) => {
        await f.skills.assertActiveSelection(tx, {
          skillId: skill.id,
          tagIds: [tag.id],
        });
        const [{ pid }] = await tx.$queryRaw`SELECT pg_backend_pid() AS pid`;
        signal(pid);
        await gate;
      });
      const pid = await selected;
      const hiding = f.tags.update(f.command(admin), tag.id, {
        status: "INACTIVE",
        expectedVersion: 1,
        reason: "Hide after selection",
      });
      let blocked = false;
      for (let attempt = 0; attempt < 50 && !blocked; attempt++) {
        const result = await f.client.query(
          "SELECT EXISTS(SELECT FROM pg_stat_activity WHERE $1 = ANY(pg_blocking_pids(pid))) AS blocked",
          [pid],
        );
        blocked = result.rows[0].blocked;
        if (!blocked) await new Promise((resolve) => setTimeout(resolve, 10));
      }
      unlock();
      await selection;
      assert.equal((await hiding).status, "INACTIVE");
      assert.equal(blocked, true);
      await assert.rejects(
        f.transactions.run((tx) =>
          f.skills.assertActiveSelection(tx, {
            skillId: skill.id,
            tagIds: [tag.id],
          }),
        ),
        status(409),
      );
    } finally {
      unlock?.();
      await selection?.catch(() => {});
      await f.dispose();
    }
  },
);
