import { test } from "node:test";
import assert from "node:assert/strict";
import { createSkillFixture } from "./helpers.mjs";
const status = (code) => (error) => error.getStatus?.() === code;
test(
  "real PostgreSQL skills catalog/sharing/verification journeys",
  { timeout: 180000 },
  async (t) => {
    const f = await createSkillFixture();
    try {
      const admin = await f.account("ADMIN"),
        staff = await f.account("STAFF"),
        owner = await f.account(),
        other = await f.account();
      let catalog, sharing, first, second;
      await t.test(
        "catalog permissions, normalized collision, idempotency and bound pagination",
        async () => {
          await assert.rejects(
            f.skills.create(f.command(staff), {
              name: "Kỹ năng",
              status: "ACTIVE",
            }),
            status(403),
          );
          const command = f.command(admin);
          catalog = await f.skills.create(command, {
            name: "Kỹ năng",
            status: "ACTIVE",
          });
          assert.equal(
            (
              await f.skills.create(command, {
                name: "Kỹ năng",
                status: "ACTIVE",
              })
            ).id,
            catalog.id,
          );
          await assert.rejects(
            f.skills.create(f.command(admin), {
              name: "  KỸ   NĂNG  ",
              status: "ACTIVE",
            }),
            status(409),
          );
          await assert.rejects(
            f.skills.create(command, { name: "Other skill", status: "ACTIVE" }),
            status(409),
          );
          await f.skills.create(f.command(admin), {
            name: "Another skill",
            status: "ACTIVE",
          });
          const p = await f.skills.list({ limit: 1 });
          assert.equal(p.pagination.hasMore, true);
          assert.equal(
            (await f.skills.list({ limit: 1, cursor: p.pagination.nextCursor }))
              .data.length,
            1,
          );
          await assert.rejects(
            f.skills.list({
              limit: 1,
              q: "Other",
              cursor: p.pagination.nextCursor,
            }),
            status(400),
          );
          assert.equal(
            (await f.skills.list({ limit: 20, q: "%_" })).data.length,
            0,
          );
        },
      );
      await t.test(
        "sharing owner boundaries, immutable skill and duplicate active",
        async () => {
          sharing = await f.sharing.create(f.command(owner), {
            skillId: catalog.id,
            level: "INTERMEDIATE",
            description: "I can teach this skill with practical examples",
            experienceYears: "2.5",
          });
          assert.equal(sharing.verificationStatus, "UNVERIFIED");
          await assert.rejects(
            f.sharing.create(f.command(owner), {
              skillId: catalog.id,
              level: "BEGINNER",
              description: "Another valid experience description",
            }),
            status(409),
          );
          await assert.rejects(
            f.sharing.change(f.command(other), sharing.id, {
              expectedVersion: 1,
              description: "This user cannot update another skill",
            }),
            status(404),
          );
        },
      );
      await t.test(
        "search/profile privacy and visibility filtering",
        async () => {
          const result = await f.sharing.search(other.principal, catalog.id, {
            limit: 20,
          });
          assert.equal(result.data.length, 1);
          assert.equal(
            JSON.stringify(result).includes(owner.user.normalizedEmail),
            false,
          );
          const profile = await f.profiles.profile(owner.user.id, true);
          assert.equal(profile.sharingSkills.data.length, 1);
          assert.equal(JSON.stringify(profile).includes("storageKey"), false);
          sharing = await f.sharing.change(f.command(owner), sharing.id, {
            isVisible: false,
            expectedVersion: sharing.version,
          });
          assert.equal(
            (await f.sharing.search(other.principal, catalog.id, { limit: 20 }))
              .data.length,
            0,
          );
          sharing = await f.sharing.change(f.command(owner), sharing.id, {
            isVisible: true,
            expectedVersion: sharing.version,
          });
        },
      );
      await t.test(
        "submit requires owned CLEAN READY files and one pending batch",
        async () => {
          const wrong = await f.readyFile(other);
          await assert.rejects(
            f.verifications.submit(f.command(owner), sharing.id, {
              fileIds: [wrong.id],
            }),
            status(404),
          );
          const unready = await f.readyFile(owner, {
            state: "QUARANTINED",
            scanVerdict: null,
          });
          await assert.rejects(
            f.verifications.submit(f.command(owner), sharing.id, {
              fileIds: [unready.id],
            }),
            status(409),
          );
          const file = await f.readyFile(owner);
          first = await f.verifications.submit(f.command(owner), sharing.id, {
            fileIds: [file.id],
          });
          assert.equal(first.status, "PENDING");
          assert.equal(first.files.length, 1);
          assert.equal(
            (await f.db.storedFile.findUnique({ where: { id: file.id } }))
              .resourceId,
            first.files[0].id,
          );
          assert.equal(
            (await f.sharing.ownList(owner.principal, { limit: 20 })).data[0]
              .verificationStatus,
            "PENDING",
          );
          const next = await f.readyFile(owner);
          await assert.rejects(
            f.verifications.submit(f.command(owner), sharing.id, {
              fileIds: [next.id],
            }),
            status(409),
          );
          const row = await f.sharing.read(sharing.id);
          await assert.rejects(
            f.sharing.change(
              f.command(owner),
              sharing.id,
              { expectedVersion: row.version },
              true,
            ),
            status(409),
          );
        },
      );
      await t.test(
        "approval atomically updates evidence, badge, counter, audit and event",
        async () => {
          await assert.rejects(
            f.verifications.decide(
              f.command(other),
              first.id,
              { expectedVersion: 1 },
              true,
            ),
            status(403),
          );
          const command = f.command(staff);
          first = await f.verifications.decide(
            command,
            first.id,
            { expectedVersion: 1 },
            true,
          );
          assert.equal(first.status, "APPROVED");
          assert.equal(first.files[0].approvalStatus, "APPROVED");
          assert.equal(
            (await f.db.user.findUnique({ where: { id: owner.user.id } }))
              .verifiedSkillCount,
            1,
          );
          assert.equal(
            (await f.sharing.read(sharing.id)).verificationStatus,
            "VERIFIED",
          );
          assert.equal(
            (
              await f.verifications.decide(
                command,
                first.id,
                { expectedVersion: 1 },
                true,
              )
            ).id,
            first.id,
          );
          assert.equal(
            await f.db.auditLog.count({ where: { targetId: first.id } }),
            1,
          );
          assert.equal(
            await f.db.outboxEvent.count({
              where: { type: "skill.verification.decided" },
            }),
            1,
          );
        },
      );
      await t.test(
        "replacement pending/rejection preserves approval and its badge",
        async () => {
          const file = await f.readyFile(owner);
          second = await f.verifications.submit(f.command(owner), sharing.id, {
            fileIds: [file.id],
          });
          assert.equal(
            (await f.sharing.read(sharing.id)).verificationStatus,
            "VERIFIED",
          );
          await assert.rejects(
            f.verifications.decide(
              f.command(staff),
              second.id,
              { expectedVersion: 1, rejectReason: "short" },
              false,
            ),
            status(400),
          );
          second = await f.verifications.decide(
            f.command(staff),
            second.id,
            {
              expectedVersion: 1,
              rejectReason: "Evidence does not demonstrate this skill",
            },
            false,
          );
          assert.equal(second.status, "REJECTED");
          assert.equal(
            (await f.sharing.read(sharing.id)).verificationStatus,
            "VERIFIED",
          );
          assert.equal(
            (
              await f.verifications.history(owner.principal, sharing.id, {
                limit: 20,
              })
            ).data[0].rejectReason,
            second.rejectReason,
          );
        },
      );
      await t.test(
        "revoke requires explicit grant, retains approval history and updates final badge",
        async () => {
          await assert.rejects(
            f.verifications.revoke(
              f.command(staff),
              first.id,
              first.files[0].id,
              "Evidence was determined to be fraudulent",
            ),
            status(403),
          );
          const result = await f.verifications.revoke(
            f.command(admin),
            first.id,
            first.files[0].id,
            "Evidence was determined to be fraudulent",
          );
          assert.equal(result.status, "APPROVED");
          assert.equal(result.files[0].approvalStatus, "REVOKED");
          assert.equal(
            (await f.sharing.read(sharing.id)).verificationStatus,
            "REJECTED",
          );
          assert.equal(
            (await f.db.user.findUnique({ where: { id: owner.user.id } }))
              .verifiedSkillCount,
            0,
          );
        },
      );
      await t.test(
        "two reviewers have one winner and audit failure rolls back all business changes",
        async () => {
          const file = await f.readyFile(owner);
          const request = await f.verifications.submit(
            f.command(owner),
            sharing.id,
            { fileIds: [file.id] },
          );
          const decisions = await Promise.allSettled([
            f.verifications.decide(
              f.command(staff),
              request.id,
              { expectedVersion: 1 },
              true,
            ),
            f.verifications.decide(
              f.command(admin),
              request.id,
              {
                expectedVersion: 1,
                rejectReason: "Evidence not sufficient for verification",
              },
              false,
            ),
          ]);
          assert.equal(
            decisions.filter((r) => r.status === "fulfilled").length,
            1,
          );
          const pendingFile = await f.readyFile(owner);
          const pending = await f.verifications.submit(
            f.command(owner),
            sharing.id,
            { fileIds: [pendingFile.id] },
          );
          const before = await f.sharing.read(sharing.id);
          const original = f.audit.append;
          f.audit.append = async () => {
            throw new Error("fixture audit insert failure");
          };
          try {
            await assert.rejects(
              f.verifications.decide(
                f.command(admin),
                pending.id,
                { expectedVersion: 1 },
                true,
              ),
            );
          } finally {
            f.audit.append = original;
          }
          assert.equal(
            (
              await f.verifications.detail(
                owner.principal,
                pending.id,
                sharing.id,
              )
            ).status,
            "PENDING",
          );
          assert.equal(
            (await f.sharing.read(sharing.id)).verificationStatus,
            before.verificationStatus,
          );
          const appendEvent = f.outbox.append;
          f.outbox.append = async () => {
            throw new Error("fixture outbox insert failure");
          };
          try {
            await assert.rejects(
              f.verifications.decide(
                f.command(admin),
                pending.id,
                { expectedVersion: 1 },
                true,
              ),
            );
          } finally {
            f.outbox.append = appendEvent;
          }
          assert.equal(
            (
              await f.verifications.detail(
                owner.principal,
                pending.id,
                sharing.id,
              )
            ).status,
            "PENDING",
          );
          assert.equal(
            (await f.sharing.read(sharing.id)).verificationStatus,
            before.verificationStatus,
          );
          assert.equal(
            await f.db.auditLog.count({ where: { targetId: pending.id } }),
            0,
          );
          await f.verifications.decide(
            f.command(staff),
            pending.id,
            {
              expectedVersion: 1,
              rejectReason: "Closing test request with a valid reason",
            },
            false,
          );
        },
      );
      await t.test(
        "reviewer replay rechecks a removed permission grant",
        async () => {
          const file = await f.readyFile(owner);
          const pending = await f.verifications.submit(
            f.command(owner),
            sharing.id,
            { fileIds: [file.id] },
          );
          const cmd = f.command(staff);
          await f.verifications.decide(
            cmd,
            pending.id,
            { expectedVersion: 1 },
            true,
          );
          const role = await f.db.role.findUniqueOrThrow({
            where: { code: "STAFF" },
          });
          const permission = await f.db.permission.findUniqueOrThrow({
            where: { code: "skill-verification:approve" },
          });
          await f.db.rolePermission.delete({
            where: {
              roleId_permissionId: {
                roleId: role.id,
                permissionId: permission.id,
              },
            },
          });
          try {
            await assert.rejects(
              f.verifications.decide(
                cmd,
                pending.id,
                { expectedVersion: 1 },
                true,
              ),
              status(403),
            );
          } finally {
            await f.db.rolePermission.create({
              data: { roleId: role.id, permissionId: permission.id },
            });
          }
        },
      );
      await t.test(
        "notification publishers are registered and consumer retries deduplicate",
        async () => {
          for (const row of await f.db.outboxEvent.findMany({
            where: {
              type: {
                in: ["skill.verification.decided", "skill.evidence.revoked"],
              },
            },
          })) {
            const event = {
              eventId: row.eventId,
              type: row.type,
              version: row.version,
              payload: row.payload,
              correlationId: row.correlationId,
            };
            const publisher = f.registry.get(row.type);
            assert.ok(publisher);
            await publisher.publish(event);
            await publisher.publish(event);
          }
          assert.equal(
            await f.db.notification.count(),
            await f.db.outboxEvent.count({
              where: {
                type: {
                  in: ["skill.verification.decided", "skill.evidence.revoked"],
                },
              },
            }),
          );
        },
      );
      await t.test(
        "archive retains history and inactive catalog blocks new sharing",
        async () => {
          const row = await f.sharing.read(sharing.id);
          await f.sharing.change(
            f.command(owner),
            sharing.id,
            { expectedVersion: row.version },
            true,
          );
          assert.equal(
            (
              await f.verifications.history(owner.principal, sharing.id, {
                limit: 20,
              })
            ).data.length >= 2,
            true,
          );
          assert.equal(
            (await f.sharing.search(other.principal, catalog.id, { limit: 20 }))
              .data.length,
            0,
          );
          await f.skills.change(f.command(admin), catalog.id, {
            expectedVersion: catalog.version,
            status: "INACTIVE",
          });
          await assert.rejects(
            f.sharing.create(f.command(other), {
              skillId: catalog.id,
              level: "BEGINNER",
              description: "A sufficiently long skill description",
            }),
            status(409),
          );
        },
      );
      await t.test(
        "replay rechecks current permission, account and session",
        async () => {
          const cmd = f.command(admin);
          const row = await f.skills.create(cmd, {
            name: "Replay protection",
            status: "ACTIVE",
          });
          assert.ok(row.id);
          await f.db.user.update({
            where: { id: admin.user.id },
            data: { accountStatus: "LOCKED" },
          });
          await assert.rejects(
            f.skills.create(cmd, {
              name: "Replay protection",
              status: "ACTIVE",
            }),
            status(401),
          );
        },
      );
    } finally {
      await f.dispose();
    }
  },
);
