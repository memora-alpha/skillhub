import { test } from "node:test";
import assert from "node:assert/strict";
import { createTagFixture, status } from "./helpers.mjs";

test(
  "requests are private, unique per pending owner and never publish a tag before approval",
  { timeout: 120000 },
  async () => {
    const f = await createTagFixture();
    try {
      const owner = await f.account(),
        other = await f.account(),
        admin = await f.account("ADMIN");
      const request = await f.tagRequests.create(f.command(owner), {
        label: "Rust",
      });
      assert.equal(request.status, "PENDING");
      assert.equal(request.requestedByUserId, owner.user.id);
      assert.equal(await f.db.tag.count(), 0);
      await assert.rejects(
        f.tagRequests.create(f.command(owner), { label: " rust " }),
        status(409),
      );
      await f.tagRequests.create(f.command(other), { label: "RUST" });
      await f.tagRequests.create(f.command(owner), { label: "Swift" });
      const firstPage = await f.tagRequests.mine(f.command(owner), {
        limit: 1,
      });
      assert.equal(firstPage.pagination.hasMore, true);
      const secondPage = await f.tagRequests.mine(f.command(owner), {
        limit: 1,
        cursor: firstPage.pagination.nextCursor,
      });
      assert.notEqual(firstPage.data[0].id, secondPage.data[0].id);
      await assert.rejects(
        f.tagRequests.mine(f.command(other), {
          limit: 1,
          cursor: firstPage.pagination.nextCursor,
        }),
        status(400),
      );
      await assert.rejects(
        f.tagRequests.mine(f.command(owner), {
          status: "PENDING",
          limit: 1,
          cursor: firstPage.pagination.nextCursor,
        }),
        status(400),
      );
      assert.equal(
        (await f.tagRequests.mine(f.command(owner), { limit: 20 })).data.length,
        2,
      );
      await assert.rejects(
        f.tagRequests.mineDetail(f.command(other), request.id),
        status(404),
      );
      assert.equal(
        (
          await f.tagRequests.adminList(f.command(admin), {
            limit: 20,
            status: "PENDING",
          })
        ).data.length,
        3,
      );
      const active = await f.tags.create(f.command(admin), {
        label: "Existing",
      });
      await assert.rejects(
        f.tagRequests.create(f.command(owner), { label: "existing" }),
        status(409),
      );
      await f.tags.update(f.command(admin), active.id, {
        status: "INACTIVE",
        expectedVersion: 1,
        reason: "Hide",
      });
      await assert.rejects(
        f.tagRequests.create(f.command(owner), { label: "existing" }),
        status(409),
      );
      await f.tagRequests.reject(f.command(admin), request.id, {
        expectedVersion: 1,
        reason: "Please use another label",
      });
      assert.equal(
        (await f.tagRequests.create(f.command(owner), { label: "Rust" }))
          .status,
        "PENDING",
      );
      const restricted = await f.account();
      const replay = f.command(restricted);
      await f.tagRequests.create(replay, { label: "Restricted replay" });
      const restriction = await f.db.userRestriction.create({
        data: {
          userId: restricted.user.id,
          scope: "CREATE_NEW_ACTIVITY",
          reasonCode: "TEST",
          startsAt: new Date(Date.now() - 1000),
          endsAt: new Date(Date.now() + 60000),
          sourceType: "TEST",
          sourceId: "tag-test",
        },
      });
      await assert.rejects(
        f.tagRequests.create(replay, { label: "Restricted replay" }),
        status(403),
      );
      assert.equal(
        (await f.tagRequests.mine(f.command(restricted), { limit: 20 })).data
          .length,
        1,
      );
      await f.db.userRestriction.update({
        where: { id: restriction.id },
        data: { scope: "ALL" },
      });
      await assert.rejects(
        f.tagRequests.mine(f.command(restricted), { limit: 20 }),
        status(403),
      );
      await f.db.userRestriction.update({
        where: { id: restriction.id },
        data: { revokedAt: new Date() },
      });
      await f.db.refreshSession.update({
        where: { id: restricted.principal.sessionId },
        data: { revokedAt: new Date(), revokedReason: "LOGOUT" },
      });
      await assert.rejects(
        f.tagRequests.create(replay, { label: "Restricted replay" }),
        status(401),
      );
    } finally {
      await f.dispose();
    }
  },
);
