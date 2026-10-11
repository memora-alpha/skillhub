import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createSkillFixture } from "./helpers.mjs";
import { PrismaUsersRepository } from "../../dist/modules/users/infrastructure/persistence/prisma-users-repository.js";

const conflict = (message) => (error) =>
  error.getStatus?.() === 409 && error.message === message;
const status = (code) => (error) => error.getStatus?.() === code;

test(
  "restore catalog and sharing skills atomically on PostgreSQL",
  { timeout: 180000 },
  async (t) => {
    const f = await createSkillFixture();
    try {
      const admin = await f.account("ADMIN"),
        owner = await f.account(),
        other = await f.account(),
        staff = await f.account("STAFF");
      const catalog = () =>
        f.skills.create(f.command(admin), {
          name: `Restore ${randomUUID()}`,
          status: "ACTIVE",
        });
      const createSharing = (skill) =>
        f.sharing.create(f.command(owner), {
          skillId: skill.id,
          level: "ADVANCED",
          description: "Practical examples and several years of teaching",
          isVisible: false,
        });
      const archiveSharing = async (id) =>
        f.sharing.change(
          f.command(owner),
          id,
          { expectedVersion: (await f.sharing.read(id)).version },
          true,
        );
      const archiveCatalog = (row) =>
        f.skills.change(
          f.command(admin),
          row.id,
          { expectedVersion: row.version, reason: "Temporarily retire skill" },
          true,
        );
      const userCount = async () =>
        (await f.db.user.findUniqueOrThrow({ where: { id: owner.user.id } }))
          .verifiedSkillCount;

      await t.test(
        "catalog restores to an explicit status; version, permissions, replay and audit",
        async () => {
          let skill = await catalog();
          await assert.rejects(
            f.skills.restore(f.command(admin), skill.id, {
              expectedVersion: skill.version,
              status: "ACTIVE",
              reason: "Restore",
            }),
            conflict("SKILL_NOT_ARCHIVED"),
          );
          skill = await archiveCatalog(skill);
          const input = {
            expectedVersion: skill.version,
            status: "INACTIVE",
            reason: "Review before publication",
          };
          await assert.rejects(
            f.skills.restore(f.command(staff), skill.id, input),
            status(403),
          );
          await assert.rejects(
            f.skills.restore(f.command(admin), skill.id, {
              ...input,
              expectedVersion: 1,
            }),
            conflict("STALE_VERSION"),
          );
          const command = f.command(admin);
          const restored = await f.skills.restore(command, skill.id, input);
          assert.equal(restored.id, skill.id);
          assert.equal(restored.status, "INACTIVE");
          assert.equal(restored.version, skill.version + 1);
          await assert.rejects(f.skills.detail(skill.id), status(404));
          assert.equal(
            (await f.skills.restore(command, skill.id, input)).version,
            restored.version,
          );
          await assert.rejects(
            f.skills.restore(command, skill.id, { ...input, status: "ACTIVE" }),
            status(409),
          );
          assert.equal(
            await f.db.auditLog.count({
              where: { targetId: skill.id, action: "SKILL_CATALOG_RESTORE" },
            }),
            1,
          );
          const active = await f.skills.change(f.command(admin), skill.id, {
            expectedVersion: restored.version,
            status: "ACTIVE",
          });
          assert.equal((await f.skills.detail(active.id)).status, "ACTIVE");
          const archived = await archiveCatalog(active);
          const published = await f.skills.restore(f.command(admin), skill.id, {
            expectedVersion: archived.version,
            status: "ACTIVE",
            reason: "Publish again",
          });
          assert.equal((await f.skills.detail(published.id)).status, "ACTIVE");
          await f.db.rolePermission.deleteMany({
            where: {
              roleIdRecord: { code: "ADMIN" },
              permissionIdRecord: { code: "skill-catalog:restore" },
            },
          });
          await assert.rejects(
            f.skills.restore(command, skill.id, input),
            status(403),
          );
          await f.db.$transaction((tx) =>
            new PrismaUsersRepository().seedRoles(tx),
          );
        },
      );

      await t.test(
        "sharing restore preserves ID, visibility, current verification and history; replay recalculates count once",
        async () => {
          const skill = await catalog();
          const sharing = await createSharing(skill);
          const file = await f.readyFile(owner);
          const submitted = await f.verifications.submit(
            f.command(owner),
            sharing.id,
            { fileIds: [file.id] },
          );
          await f.verifications.decide(
            f.command(staff),
            submitted.id,
            { expectedVersion: 1 },
            true,
          );
          const count = await userCount();
          const archived = await archiveSharing(sharing.id);
          assert.equal(await userCount(), count - 1);
          const input = { expectedVersion: archived.version };
          await assert.rejects(
            f.sharing.restore(f.command(other), sharing.id, input),
            status(404),
          );
          await assert.rejects(
            f.sharing.restore(f.command(owner), sharing.id, {
              expectedVersion: 1,
            }),
            conflict("STALE_VERSION"),
          );
          const command = f.command(owner);
          const restored = await f.sharing.restore(command, sharing.id, input);
          assert.equal(restored.id, sharing.id);
          assert.equal(restored.archivedAt, null);
          assert.equal(restored.isVisible, false);
          assert.equal(restored.verificationStatus, "VERIFIED");
          assert.equal(restored.version, archived.version + 1);
          assert.equal(restored.latestVerification.id, submitted.id);
          assert.equal(await userCount(), count);
          assert.equal(
            (
              await f.sharing.publicList(owner.user.id, { limit: 20 })
            ).data.some((r) => r.id === sharing.id),
            false,
          );
          assert.equal(
            (await f.sharing.restore(command, sharing.id, input)).version,
            restored.version,
          );
          assert.equal(await userCount(), count);
          assert.equal(
            await f.db.auditLog.count({
              where: { targetId: sharing.id, action: "SHARING_SKILL_RESTORE" },
            }),
            1,
          );
          await assert.rejects(
            f.sharing.restore(f.command(owner), sharing.id, {
              expectedVersion: restored.version,
            }),
            conflict("SHARING_SKILL_NOT_ARCHIVED"),
          );
          await f.sharing.change(f.command(owner), sharing.id, {
            expectedVersion: restored.version,
            isVisible: true,
          });
          assert.equal(
            (
              await f.sharing.search(other.principal, skill.id, {
                limit: 20,
                verifiedOnly: true,
              })
            ).data[0].id,
            sharing.id,
          );
          await archiveSharing(sharing.id);
          await f.verifications.revoke(
            f.command(admin),
            submitted.id,
            submitted.files[0].id,
            "Approval revoked while archived",
          );
          const revoked = await f.sharing.read(sharing.id);
          const afterRevoke = await f.sharing.restore(
            f.command(owner),
            sharing.id,
            { expectedVersion: revoked.version },
          );
          assert.equal(afterRevoke.verificationStatus, "REJECTED");
          assert.equal(await userCount(), count - 1);
          await f.db.userRestriction.create({
            data: {
              userId: owner.user.id,
              scope: "sharing-skill:restore:self",
              reasonCode: "FIXTURE_RESTORE_RESTRICTION",
              sourceType: "FIXTURE",
              sourceId: randomUUID(),
              startsAt: new Date(Date.now() - 1000),
              endsAt: new Date(Date.now() + 60000),
            },
          });
          await assert.rejects(
            f.sharing.restore(command, sharing.id, input),
            status(403),
          );
          await f.db.userRestriction.deleteMany({
            where: { userId: owner.user.id },
          });
        },
      );

      await t.test(
        "inactive/archived catalog and duplicate current skill block sharing restore",
        async () => {
          let skill = await catalog();
          const sharing = await createSharing(skill);
          const archived = await archiveSharing(sharing.id);
          skill = await f.skills.change(f.command(admin), skill.id, {
            expectedVersion: skill.version,
            status: "INACTIVE",
          });
          await assert.rejects(
            f.sharing.restore(f.command(owner), sharing.id, {
              expectedVersion: archived.version,
            }),
            conflict("SKILL_NOT_ACTIVE"),
          );
          skill = await archiveCatalog(skill);
          await assert.rejects(
            f.sharing.restore(f.command(owner), sharing.id, {
              expectedVersion: archived.version,
            }),
            conflict("SKILL_NOT_ACTIVE"),
          );
          skill = await f.skills.restore(f.command(admin), skill.id, {
            expectedVersion: skill.version,
            status: "ACTIVE",
            reason: "Restore catalog first",
          });
          const replacement = await createSharing(skill);
          await assert.rejects(
            f.sharing.restore(f.command(owner), sharing.id, {
              expectedVersion: archived.version,
            }),
            conflict("SKILL_DUPLICATE"),
          );
          assert.ok((await f.sharing.read(sharing.id)).archivedAt);
          assert.equal(
            await f.db.auditLog.count({
              where: { targetId: sharing.id, action: "SHARING_SKILL_RESTORE" },
            }),
            0,
          );
          await archiveSharing(replacement.id);
          assert.equal(
            (
              await f.sharing.restore(f.command(owner), sharing.id, {
                expectedVersion: archived.version,
              })
            ).archivedAt,
            null,
          );
        },
      );

      await t.test(
        "restore versus create and two archived restores have a single winner",
        async () => {
          for (const contender of ["create", "restore"]) {
            const skill = await catalog();
            const first = await createSharing(skill);
            const archived = await archiveSharing(first.id);
            let second;
            if (contender === "restore")
              second = await archiveSharing((await createSharing(skill)).id);
            const results = await Promise.allSettled([
              f.sharing.restore(f.command(owner), first.id, {
                expectedVersion: archived.version,
              }),
              contender === "create"
                ? createSharing(skill)
                : f.sharing.restore(f.command(owner), second.id, {
                    expectedVersion: second.version,
                  }),
            ]);
            assert.equal(
              results.filter((r) => r.status === "fulfilled").length,
              1,
            );
            assert.equal(
              results.find((r) => r.status === "rejected").reason.getStatus(),
              409,
            );
            assert.equal(
              await f.db.sharingSkill.count({
                where: {
                  userId: owner.user.id,
                  skillId: skill.id,
                  archivedAt: null,
                },
              }),
              1,
            );
          }
        },
      );

      await t.test(
        "audit failure rolls back catalog/sharing state, count and idempotency completion",
        async () => {
          const skill = await catalog();
          const sharing = await createSharing(skill);
          const file = await f.readyFile(owner);
          const verification = await f.verifications.submit(
            f.command(owner),
            sharing.id,
            { fileIds: [file.id] },
          );
          await f.verifications.decide(
            f.command(staff),
            verification.id,
            { expectedVersion: 1 },
            true,
          );
          const archivedSharing = await archiveSharing(sharing.id);
          const count = await userCount();
          const command = f.command(owner);
          const append = f.audit.append;
          f.audit.append = async () => {
            throw new Error("fixture audit failure");
          };
          try {
            await assert.rejects(
              f.sharing.restore(command, sharing.id, {
                expectedVersion: archivedSharing.version,
              }),
              /fixture audit failure/,
            );
          } finally {
            f.audit.append = append;
          }
          assert.ok((await f.sharing.read(sharing.id)).archivedAt);
          assert.equal(
            (await f.sharing.read(sharing.id)).version,
            archivedSharing.version,
          );
          assert.equal(await userCount(), count);
          assert.equal(
            (
              await f.sharing.restore(command, sharing.id, {
                expectedVersion: archivedSharing.version,
              })
            ).archivedAt,
            null,
          );
          const archivedSkill = await archiveCatalog(skill);
          const adminCommand = f.command(admin);
          const input = {
            expectedVersion: archivedSkill.version,
            status: "ACTIVE",
            reason: "Restore after failure",
          };
          f.audit.append = async () => {
            throw new Error("fixture audit failure");
          };
          try {
            await assert.rejects(
              f.skills.restore(adminCommand, skill.id, input),
              /fixture audit failure/,
            );
          } finally {
            f.audit.append = append;
          }
          assert.equal(
            (
              await f.skills.adminList(f.command(admin), {
                limit: 50,
                status: "ARCHIVED",
              })
            ).data.find((r) => r.id === skill.id).version,
            archivedSkill.version,
          );
          assert.equal(
            (await f.skills.restore(adminCommand, skill.id, input)).status,
            "ACTIVE",
          );
        },
      );
    } finally {
      await f.dispose();
    }
  },
);
