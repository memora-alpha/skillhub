import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createSkillFixture } from "./helpers.mjs";

test(
  "request offerings enforce ownership and expose current public skill metadata on PostgreSQL",
  { timeout: 120000 },
  async (t) => {
    const f = await createSkillFixture();
    try {
      const admin = await f.account("ADMIN");
      const staff = await f.account("STAFF");
      const owner = await f.account();
      const other = await f.account();
      const create = async (account, name, isVisible = true) => {
        const skill = await f.skills.create(f.command(admin), {
          name,
          status: "ACTIVE",
        });
        const sharing = await f.sharing.create(f.command(account), {
          skillId: skill.id,
          level: "INTERMEDIATE",
          description:
            "Private profile description should not enter a request offering card",
          isVisible,
        });
        return { skill, sharing };
      };
      const own = await create(owner, "Own offered skill");
      const foreign = await create(other, "Foreign offered skill");
      const hidden = await create(owner, "Hidden offered skill", false);
      const archived = await create(owner, "Archived offered skill");
      await f.sharing.change(
        f.command(owner),
        archived.sharing.id,
        { expectedVersion: archived.sharing.version },
        true,
      );
      const inactive = await create(owner, "Inactive offered skill");
      await f.skills.change(f.command(admin), inactive.skill.id, {
        expectedVersion: inactive.skill.version,
        status: "INACTIVE",
      });
      const validate = (ids) =>
        f.db.$transaction((tx) =>
          f.sharing.assertRequestOfferings(tx, owner.user.id, ids),
        );
      const read = (ids) =>
        f.db.$transaction((tx) => f.sharing.readRequestOfferings(tx, ids));

      await t.test(
        "selection accepts empty/eligible IDs and rejects foreign, missing, hidden, archived and inactive skills",
        async () => {
          await assert.doesNotReject(validate([]));
          await assert.doesNotReject(validate([own.sharing.id]));
          for (const [id, expected] of [
            [foreign.sharing.id, 404],
            [randomUUID(), 404],
            [hidden.sharing.id, 409],
            [archived.sharing.id, 409],
            [inactive.sharing.id, 409],
          ]) {
            await assert.rejects(
              validate([id]),
              (error) => error.getStatus?.() === expected,
            );
          }
        },
      );

      await t.test(
        "batched projection omits unavailable selections and private profile metadata",
        async () => {
          assert.deepEqual(await read([]), []);
          const rows = await read([
            own.sharing.id,
            foreign.sharing.id,
            hidden.sharing.id,
            archived.sharing.id,
            inactive.sharing.id,
            randomUUID(),
          ]);
          assert.equal(rows.length, 2);
          assert.deepEqual(
            new Set(rows.map(({ id }) => id)),
            new Set([own.sharing.id, foreign.sharing.id]),
          );
          assert.deepEqual(
            rows.find(({ id }) => id === own.sharing.id),
            {
              id: own.sharing.id,
              ownerId: owner.user.id,
              skill: { id: own.skill.id, name: "Own offered skill" },
              level: "INTERMEDIATE",
              verificationStatus: "UNVERIFIED",
            },
          );
          for (const row of rows) {
            assert.deepEqual(Object.keys(row).sort(), [
              "id",
              "level",
              "ownerId",
              "skill",
              "verificationStatus",
            ]);
            assert.deepEqual(Object.keys(row.skill).sort(), ["id", "name"]);
          }
        },
      );

      await t.test(
        "projection reflects skill edits and verification, then hides newly unavailable owners/skills",
        async () => {
          await f.skills.change(f.command(admin), own.skill.id, {
            expectedVersion: own.skill.version,
            name: "Renamed offered skill",
          });
          await f.sharing.change(f.command(owner), own.sharing.id, {
            expectedVersion: own.sharing.version,
            level: "EXPERT",
          });
          const file = await f.readyFile(owner);
          const submitted = await f.verifications.submit(
            f.command(owner),
            own.sharing.id,
            { fileIds: [file.id] },
          );
          assert.equal(
            (await read([own.sharing.id]))[0].verificationStatus,
            "PENDING",
          );
          await f.verifications.decide(
            f.command(staff),
            submitted.id,
            { expectedVersion: submitted.version },
            true,
          );
          assert.deepEqual(await read([own.sharing.id]), [
            {
              id: own.sharing.id,
              ownerId: owner.user.id,
              skill: { id: own.skill.id, name: "Renamed offered skill" },
              level: "EXPERT",
              verificationStatus: "VERIFIED",
            },
          ]);
          const current = await f.sharing.read(own.sharing.id);
          await f.sharing.change(f.command(owner), own.sharing.id, {
            expectedVersion: current.version,
            isVisible: false,
          });
          assert.deepEqual(await read([own.sharing.id]), []);
          await f.db.user.update({
            where: { id: other.user.id },
            data: { accountStatus: "LOCKED" },
          });
          assert.deepEqual(await read([foreign.sharing.id]), []);
          assert.equal(
            (await f.sharing.read(own.sharing.id)).id,
            own.sharing.id,
          );
        },
      );
    } finally {
      await f.dispose();
    }
  },
);
