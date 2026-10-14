import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createSkillFixture } from "./helpers.mjs";

test(
  "upgrade backfills normalized keys and reports colliding historical skill IDs",
  { timeout: 120000 },
  async () => {
    const id = randomUUID();
    const f = await createSkillFixture((client) =>
      client.query(
        "INSERT INTO skills(skill_id,name,slug,status) VALUES($1,$2,$3,$4)",
        [id, "Kỹ năng cũ", "legacy-skill", "ACTIVE"],
      ),
    );
    try {
      const row = await f.db.skill.findUniqueOrThrow({ where: { id } });
      assert.equal(row.nameKey, "kỹ năng cũ");
      assert.equal(row.version, 1);
      assert.equal(await f.db.skillLevel.count({ where: { skillId: id } }), 4);
      const owner = await f.account();
      await assert.rejects(
        f.db.sharingSkill.create({
          data: {
            userId: owner.user.id,
            skillId: id,
            level: "BEGINNER",
            verificationStatus: "UNVERIFIED",
            isVisible: true,
            description: "short",
          },
        }),
      );
      const sharing = await f.db.sharingSkill.create({
        data: {
          userId: owner.user.id,
          skillId: id,
          level: "BEGINNER",
          verificationStatus: "UNVERIFIED",
          isVisible: true,
          description: "A valid historical teaching description",
        },
      });
      await assert.rejects(
        f.db.sharingSkill.create({
          data: {
            userId: owner.user.id,
            skillId: id,
            level: "BEGINNER",
            verificationStatus: "UNVERIFIED",
            isVisible: true,
            description: "A duplicate active sharing skill description",
          },
        }),
      );
      // Deferred count constraint rejects an empty batch at commit.
      await assert.rejects(
        f.db.$transaction((tx) =>
          tx.skillVerification.create({
            data: {
              sharingSkillId: sharing.id,
              status: "PENDING",
              submittedAt: new Date(),
            },
          }),
        ),
      );
    } finally {
      await f.dispose();
    }
    const first = randomUUID(),
      second = randomUUID();
    await assert.rejects(
      createSkillFixture(async (client) => {
        await client.query(
          "INSERT INTO skills(skill_id,name,slug,status) VALUES($1,$2,$3,$4),($5,$6,$7,$4)",
          [
            first,
            "Same skill",
            "collision-a",
            "ACTIVE",
            second,
            " SAME   SKILL ",
            "collision-b",
          ],
        );
      }),
      (error) =>
        error.message.includes(first) && error.message.includes(second),
    );
  },
);
