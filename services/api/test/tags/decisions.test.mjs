import { test } from "node:test";
import assert from "node:assert/strict";
import { createTagFixture, status } from "./helpers.mjs";

test(
  "review races, canonical reuse, rollback and replay preserve one audited decision",
  { timeout: 180000 },
  async () => {
    const f = await createTagFixture();
    try {
      const admins = [await f.account("ADMIN"), await f.account("ADMIN")];
      const owner = await f.account(),
        other = await f.account();
      const first = await f.tagRequests.create(f.command(owner), {
        label: "Go",
      });
      const second = await f.tagRequests.create(f.command(other), {
        label: "GO",
      });
      const [a, b] = await Promise.all([
        f.tagRequests.approve(f.command(admins[0]), first.id, {
          expectedVersion: 1,
        }),
        f.tagRequests.approve(f.command(admins[1]), second.id, {
          expectedVersion: 1,
        }),
      ]);
      assert.equal(a.resultTagId, b.resultTagId);
      assert.equal(await f.db.tag.count(), 1);
      assert.equal(
        (
          await f.db.user.findUniqueOrThrow({
            where: { id: owner.user.id },
            include: { roleIdRecord: true },
          })
        ).roleIdRecord.code,
        "USER",
      );
      const pending = await f.tagRequests.create(f.command(owner), {
        label: "Review race",
      });
      const raced = await Promise.allSettled([
        f.tagRequests.approve(f.command(admins[0]), pending.id, {
          expectedVersion: 1,
        }),
        f.tagRequests.reject(f.command(admins[1]), pending.id, {
          expectedVersion: 1,
          reason: "Reject competing request",
        }),
      ]);
      assert.equal(raced.filter((row) => row.status === "fulfilled").length, 1);
      assert.equal(
        raced.find((row) => row.status === "rejected").reason.getStatus(),
        409,
      );
      const sameRequest = await f.tagRequests.create(f.command(owner), {
        label: "Double approval",
      });
      const double = await Promise.allSettled(
        admins.map((admin) =>
          f.tagRequests.approve(f.command(admin), sameRequest.id, {
            expectedVersion: 1,
          }),
        ),
      );
      assert.equal(
        double.filter((row) => row.status === "fulfilled").length,
        1,
      );
      const directRace = await f.tagRequests.create(f.command(owner), {
        label: "Direct race",
      });
      const creating = await Promise.allSettled([
        f.tags.create(f.command(admins[0]), { label: "Direct race" }),
        f.tagRequests.approve(f.command(admins[1]), directRace.id, {
          expectedVersion: 1,
        }),
      ]);
      assert.equal(creating[1].status, "fulfilled");
      if (creating[0].status === "rejected")
        assert.equal(creating[0].reason.getStatus(), 409);
      assert.equal(
        await f.db.tag.count({ where: { labelKey: "direct race" } }),
        1,
      );
      const replayRequest = await f.tagRequests.create(f.command(owner), {
        label: "Replay",
      });
      const command = f.command(admins[0]);
      const approved = await f.tagRequests.approve(command, replayRequest.id, {
        expectedVersion: 1,
      });
      assert.equal(
        (
          await f.tagRequests.approve(command, replayRequest.id, {
            expectedVersion: 1,
          })
        ).resultTagId,
        approved.resultTagId,
      );
      assert.equal(
        await f.db.auditLog.count({
          where: { targetId: replayRequest.id, action: "TAG_REQUEST_APPROVE" },
        }),
        1,
      );
      await assert.rejects(
        f.tagRequests.approve(command, first.id, { expectedVersion: 1 }),
        status(409),
      );
      const rollback = await f.tagRequests.create(f.command(owner), {
        label: "Rollback",
      });
      const original = f.audit.append;
      f.audit.append = async () => {
        throw new Error("audit unavailable");
      };
      await assert.rejects(
        f.tagRequests.approve(f.command(admins[0]), rollback.id, {
          expectedVersion: 1,
        }),
        /audit unavailable/,
      );
      f.audit.append = original;
      assert.equal(
        (
          await f.db.tagCreationRequest.findUniqueOrThrow({
            where: { id: rollback.id },
          })
        ).status,
        "PENDING",
      );
      assert.equal(
        await f.db.tag.count({ where: { labelKey: "rollback" } }),
        0,
      );
      const waiting = await f.tagRequests.create(f.command(owner), {
        label: "Hidden race",
      });
      const canonical = await f.tags.create(f.command(admins[1]), {
        label: "hidden race",
      });
      await f.tags.update(f.command(admins[1]), canonical.id, {
        status: "INACTIVE",
        expectedVersion: 1,
        reason: "Do not restore during approval",
      });
      await assert.rejects(
        f.tagRequests.approve(f.command(admins[0]), waiting.id, {
          expectedVersion: 1,
        }),
        status(409),
      );
      assert.equal(
        (await f.tagRequests.adminDetail(f.command(admins[0]), waiting.id))
          .status,
        "PENDING",
      );
      const permission = await f.db.permission.findUniqueOrThrow({
        where: { code: "tag-request:approve" },
      });
      const reuse = await f.tagRequests.create(f.command(owner), {
        label: "Keep canonical creator",
      });
      const originalCreator = await f.tags.create(f.command(admins[0]), {
        label: "Keep canonical creator",
      });
      const linked = await f.tagRequests.approve(
        f.command(admins[1]),
        reuse.id,
        { expectedVersion: 1 },
      );
      assert.equal(linked.resultTagId, originalCreator.id);
      assert.equal(
        (
          await f.db.tag.findUniqueOrThrow({
            where: { id: originalCreator.id },
          })
        ).createdByUserId,
        admins[0].user.id,
      );
      const staff = await f.account("STAFF");
      await f.db.rolePermission.create({
        data: { roleId: staff.user.roleId, permissionId: permission.id },
      });
      await assert.rejects(
        f.tagRequests.approve(f.command(staff), waiting.id, {
          expectedVersion: 1,
        }),
        status(403),
      );
      await f.db.rolePermission.deleteMany({
        where: { roleId: admins[0].user.roleId, permissionId: permission.id },
      });
      await assert.rejects(
        f.tagRequests.approve(command, replayRequest.id, {
          expectedVersion: 1,
        }),
        status(403),
      );
    } finally {
      await f.dispose();
    }
  },
);
