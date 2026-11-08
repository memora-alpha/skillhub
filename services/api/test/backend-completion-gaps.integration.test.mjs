import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { test } from "node:test";
import { createMaterialFixture } from "./materials/fixture.mjs";
import { FeePolicyAdminService } from "../dist/modules/credit/application/services/fee-policy-admin.service.js";
import { ReauthProofService } from "../dist/modules/auth/application/services/reauth-proof.service.js";
import { IdentityConfig } from "../dist/configs/identity.config.js";
import { ProfileModerationService } from "../dist/modules/users/application/services/profile-moderation.service.js";
import { ReviewModerationService } from "../dist/modules/reviews/application/services/review-moderation.service.js";
import { PublicReviewsService } from "../dist/modules/reviews/application/services/public-reviews.service.js";
import { NotificationPreferencesService } from "../dist/modules/notifications/application/services/notification-preferences.service.js";
import { ConnectionNotificationService } from "../dist/modules/notifications/application/services/connection-notification.service.js";
import { SharingSkillsRepository } from "../dist/modules/sharing-skills/infrastructure/persistence/sharing-skills.repository.js";

// The isolated suite must not depend on a developer's ignored identity env.
Object.assign(process.env, {
  NODE_ENV: "test",
  IDENTITY_JWT_KEY: randomBytes(48).toString("base64"),
  IDENTITY_OTP_KEY: randomBytes(32).toString("base64"),
  IDENTITY_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
  IDENTITY_KEY_ID: "completion-test",
  IDENTITY_PREVIOUS_KEYS: "",
  IDENTITY_JWT_ISSUER: "completion-test",
  IDENTITY_JWT_AUDIENCE: "completion-test",
  IDENTITY_TERMS_VERSION: "test",
  IDENTITY_DEFAULT_TIMEZONE: "UTC",
  IDENTITY_INITIAL_REPUTATION: "50",
});
for (const key of [
  "ACCESS_SECONDS",
  "REFRESH_SECONDS",
  "REMEMBER_SECONDS",
  "RESET_SECONDS",
  "REAUTH_SECONDS",
  "THROTTLE_WINDOW_SECONDS",
  "EMAIL_RATE_LIMIT",
  "IP_RATE_LIMIT",
  "DEVICE_RATE_LIMIT",
  "REQUEST_RATE_LIMIT",
  "DELIVERY_ATTEMPTS",
  "DELIVERY_RETENTION_SECONDS",
  "NOTIFICATION_SECONDS",
  "AVATAR_RETENTION_SECONDS",
])
  process.env[`IDENTITY_${key}`] = "3600";

test(
  "completion-gap migration, policy concurrency, snapshots, moderation and pagination on isolated PostgreSQL",
  { skip: !process.env.TEST_DATABASE_URL, timeout: 240000 },
  async (t) => {
    const f = await createMaterialFixture();
    try {
      const admin = await f.account("ADMIN"),
        admin2 = await f.account("ADMIN"),
        seller = await f.account(),
        buyer = await f.account();
      const config = f.identity.module.get(IdentityConfig),
        reauth = f.identity.module.get(ReauthProofService);
      const proof = async (account = admin) => {
        const token = config.crypto.secret();
        await f.db.reauthProof.create({
          data: {
            userId: account.principal.userId,
            sessionId: account.principal.sessionId,
            securityVersion: account.principal.securityVersion,
            purpose: "STAFF_ROLE_CHANGE",
            digest: config.crypto.secretDigest(token),
            expiresAt: new Date(Date.now() + 60000),
          },
        });
        return token;
      };
      const fees = new FeePolicyAdminService(
        f.transactions,
        f.identity.sessions,
        reauth,
        f.identity.audit,
      );
      let draft, item, order1, order2;
      await t.test(
        "paid orders pin old and new policies; self approval is allowed and consumes one proof",
        async () => {
          await f.fund(buyer, 100000n);
          item = await f.publishedMaterial(seller, {
            accessType: "PAID",
            priceCredit: "10.01",
          });
          order1 = await f.purchases.purchase(
            buyer.principal,
            item.id,
            item.listingVersion,
            randomUUID(),
          );
          assert.equal(order1.order.feeAmount, "0.50");
          draft = await fees.create(admin.principal, {
            versionNo: 2,
            feeBps: 1000,
            reason: "New material sale fee",
            reauthToken: await proof(),
          });
          assert.equal(draft.status, "DRAFT");
          const token = await proof();
          const approved = await fees.approve(admin.principal, draft.id, {
            reason: "Approve same Admin draft",
            reauthToken: token,
          });
          assert.equal(approved.createdBy, admin.user.id);
          assert.equal(approved.approvedByUserId, admin.user.id);
          const buyer2 = await f.account();
          await f.fund(buyer2, 10000n);
          order2 = await f.purchases.purchase(
            buyer2.principal,
            item.id,
            item.listingVersion,
            randomUUID(),
          );
          assert.equal(order2.order.feeAmount, "1.00");
          const old = await f.db.materialOrder.findUniqueOrThrow({
            where: { id: order1.order.id },
          });
          assert.equal(old.feeAmount, 50n);
          assert.notEqual(old.feePolicyId, draft.id);
          const oneWay = await f.db.feePolicyVersion.findFirstOrThrow({
            where: { policyCode: "ONE_WAY" },
          });
          await assert.rejects(
            fees.approve(admin.principal, oneWay.id, {
              reason: "Try changing learning fee",
              reauthToken: await proof(),
            }),
            /LEARNING_FEE_FIXED_AT_FOUR_PERCENT/,
          );
          await assert.rejects(
            fees.approve(admin.principal, draft.id, {
              reason: "Duplicate decision",
              reauthToken: token,
            }),
            /FEE_POLICY_ALREADY_DECIDED/,
          );
          assert.ok(
            (
              await f.db.reauthProof.findUniqueOrThrow({
                where: { digest: config.crypto.secretDigest(token) },
              })
            ).consumedAt,
          );
        },
      );
      await t.test(
        "concurrent version allocation permits one draft; audit failure rolls back draft and proof",
        async () => {
          const tokens = await Promise.all([proof(), proof(admin2)]);
          const results = await Promise.allSettled(
            [admin, admin2].map((account, i) =>
              fees.create(account.principal, {
                versionNo: 3,
                feeBps: 750,
                reason: "Concurrent candidate",
                reauthToken: tokens[i],
              }),
            ),
          );
          assert.equal(
            results.filter((r) => r.status === "fulfilled").length,
            1,
          );
          assert.match(
            results.find((r) => r.status === "rejected").reason.message,
            /STALE_FEE_POLICY_VERSION/,
          );
          const failing = new FeePolicyAdminService(
            f.transactions,
            f.identity.sessions,
            reauth,
            {
              append: async () => {
                throw new Error("audit rollback");
              },
            },
          );
          const token = await proof();
          await assert.rejects(
            failing.create(admin.principal, {
              versionNo: 4,
              feeBps: 700,
              reason: "Rollback candidate",
              reauthToken: token,
            }),
            /audit rollback/,
          );
          assert.equal(
            await f.db.feePolicyVersion.count({
              where: { policyCode: "MATERIAL_PAID", versionNo: 4 },
            }),
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
          await assert.rejects(
            fees.create(f.moderator.principal, {
              versionNo: 4,
              feeBps: 700,
              reason: "Staff not permitted",
              reauthToken: token,
            }),
            /FEE_ADMIN_REQUIRED/,
          );
        },
      );
      await t.test(
        "daily/monthly fee report is exact, counts material refunds and changes no wallet",
        async () => {
          const wallets = await f.db.creditWallet.findMany({
            orderBy: { userId: "asc" },
          });
          const query = {
            from: new Date(Date.now() - 86400000).toISOString(),
            to: new Date(Date.now() + 86400000).toISOString(),
            granularity: "day",
          };
          let report = await fees.revenue(admin.principal, query);
          assert.equal(
            report.items.find((row) => row.business === "MATERIAL_PURCHASE")
              .collectedCredit,
            "1.50",
          );
          await f.purchases.refund(buyer.principal, order1.order.id);
          report = await fees.revenue(admin.principal, {
            ...query,
            granularity: "month",
          });
          const material = report.items.find(
            (row) => row.business === "MATERIAL_PURCHASE",
          );
          assert.equal(material.refundedCredit, "0.50");
          assert.equal(material.netCredit, "1.00");
          const afterRefund = await f.db.creditWallet.findMany({
            orderBy: { userId: "asc" },
          });
          await fees.revenue(admin.principal, query);
          assert.deepEqual(
            await f.db.creditWallet.findMany({ orderBy: { userId: "asc" } }),
            afterRefund,
          );
          assert.notDeepEqual(afterRefund, wallets);
        },
      );
      await t.test(
        "owner and Staff material pagination reaches beyond 100 with bound filters",
        async () => {
          await f.db.material.createMany({
            data: Array.from({ length: 125 }, (_, i) => ({
              ownerId: seller.user.id,
              skillId: f.skill.id,
              title: "Pagination draft " + i,
              description: "Enough description for pagination",
              accessType: "FREE",
              priceCredit: 0n,
              status: "REJECTED",
              moderationStatus: "REJECTED",
              listingVersion: 1,
            })),
          });
          const first = await f.materials.listMine(seller.principal, {
            limit: 100,
          });
          const next = await f.materials.listMine(seller.principal, {
            limit: 100,
            cursor: first.pagination.nextCursor,
          });
          assert.equal(first.data.length, 100);
          assert.equal(next.data.length, 26);
          assert.equal(
            new Set([...first.data, ...next.data].map((row) => row.id)).size,
            126,
          );
          await assert.rejects(
            f.materials.listMine(buyer.principal, {
              cursor: first.pagination.nextCursor,
            }),
            /INVALID_CURSOR/,
          );
          const queue = await f.moderation.queue(
            f.moderator.principal,
            "REJECTED",
            { limit: 100 },
          );
          assert.equal(
            (
              await f.moderation.queue(f.moderator.principal, "REJECTED", {
                cursor: queue.pagination.nextCursor,
                limit: 100,
              })
            ).data.length,
            25,
          );
          await assert.rejects(
            f.moderation.queue(f.moderator.principal, "HIDDEN", {
              cursor: queue.pagination.nextCursor,
            }),
            /INVALID_CURSOR/,
          );
        },
      );
      await t.test(
        "buyer order pagination reaches old orders beyond 100 without cross-buyer cursors",
        async () => {
          const original = await f.db.materialOrder.findUniqueOrThrow({
            where: { id: order1.order.id },
          });
          const operations = Array.from({ length: 125 }, () => ({
            id: randomUUID(),
            operationType: "READ_PAGE_FIXTURE",
            referenceType: "MATERIAL_ORDER",
            referenceId: randomUUID(),
            idempotencyKey: randomUUID(),
            status: "SUCCESS",
          }));
          await f.db.creditOperation.createMany({ data: operations });
          await f.db.materialOrder.createMany({
            data: operations.map((operation) => ({
              ...original,
              id: randomUUID(),
              operationId: operation.id,
              idempotencyKey: randomUUID(),
              status: "SUCCESS",
            })),
          });
          const first = await f.purchases.listOrders(buyer.principal, {
            limit: 100,
          });
          const last = await f.purchases.listOrders(buyer.principal, {
            limit: 100,
            cursor: first.pagination.nextCursor,
          });
          assert.equal(first.data.length, 100);
          assert.equal(last.data.length, 26);
          assert.equal(
            new Set([...first.data, ...last.data].map((row) => row.id)).size,
            126,
          );
          await assert.rejects(
            f.purchases.listOrders(seller.principal, {
              cursor: first.pagination.nextCursor,
            }),
            /INVALID_CURSOR/,
          );
        },
      );
      await t.test(
        "Sharing Skills sort globally by creation time before pagination",
        async () => {
          const skill2 = await f.db.skill.create({
            data: {
              name: "Other skill",
              nameKey: randomUUID(),
              slug: randomUUID(),
              status: "ACTIVE",
            },
          });
          const earlier = new Date(Date.now() - 86400000),
            later = new Date();
          const low = "00000000-0000-4000-8000-000000000001",
            high = "ffffffff-ffff-4fff-8fff-ffffffffffff";
          await f.db.sharingSkill.createMany({
            data: [
              {
                id: high,
                userId: seller.user.id,
                skillId: f.skill.id,
                level: "BEGINNER",
                description: "Earlier skill description",
                verificationStatus: "UNVERIFIED",
                isVisible: true,
                createdAt: earlier,
              },
              {
                id: low,
                userId: seller.user.id,
                skillId: skill2.id,
                level: "BEGINNER",
                description: "Later sharing skill description",
                verificationStatus: "UNVERIFIED",
                isVisible: true,
                createdAt: later,
              },
            ],
          });
          const repository = new SharingSkillsRepository(f.db);
          const first = await repository.list(seller.user.id, { limit: 1 });
          assert.equal(first.data[0].id, low);
          assert.equal(+first.data[0].createdAt, +later);
          assert.equal(
            (
              await repository.list(seller.user.id, {
                limit: 1,
                cursor: first.pagination.nextCursor,
              })
            ).data[0].id,
            high,
          );
        },
      );
      await t.test(
        "preferences persist and direct notifications respect opted-out groups",
        async () => {
          const preferences = new NotificationPreferencesService(
            f.transactions,
            f.identity.sessions,
          );
          assert.deepEqual(await preferences.read(seller.principal), {
            learning: true,
            credit: true,
            community: true,
          });
          await preferences.update(seller.principal, { learning: false });
          await preferences.update(seller.principal, { credit: false });
          assert.deepEqual(await preferences.read(seller.principal), {
            learning: false,
            credit: false,
            community: true,
          });
          const notifications = new ConnectionNotificationService(),
            id = randomUUID();
          assert.equal(
            await f.transactions.run((tx) =>
              notifications.create(tx, {
                userId: seller.user.id,
                proposalId: id,
                type: "proposal.updated",
              }),
            ),
            null,
          );
          assert.equal(
            await f.db.notification.count({
              where: { userId: seller.user.id },
            }),
            0,
          );
          await assert.rejects(
            f.db.user.update({
              where: { id: seller.user.id },
              data: { notificationPreferences: { learning: "no" } },
            }),
            /users_notification_preferences_valid/,
          );
        },
      );
      await t.test(
        "profile moderation rejects missing/self grants, hides bio and cancels quarantined avatar selection",
        async () => {
          const profiles = new ProfileModerationService(
            f.db,
            f.identity.sessions,
            f.identity.audit,
            { url: async () => "https://fixture.invalid/avatar" },
          );
          await assert.rejects(
            profiles.read(f.moderator.principal, seller.user.id),
            /PROFILE_MODERATION_REQUIRED/,
          );
          await assert.rejects(
            profiles.read(admin.principal, admin.user.id),
            /PROFILE_SELF_MODERATION_FORBIDDEN/,
          );
          await f.db.user.update({
            where: { id: seller.user.id },
            data: { bio: "Violation to hide" },
          });
          let current = await profiles.read(admin.principal, seller.user.id);
          const changed = await profiles.change(
            admin.principal,
            seller.user.id,
            {
              field: "BIO",
              action: "HIDE",
              reason: "Bio violates policy",
              expectedUpdatedAt: current.updatedAt.toISOString(),
            },
          );
          assert.equal(
            (await f.profiles.profile(seller.user.id, true)).bio,
            "",
          );
          assert.equal(
            "profileModeration" in
              (await f.profiles.profile(seller.user.id, true)),
            false,
          );
          assert.equal(
            (await f.profiles.profile(seller.user.id)).profileModeration.bio
              .action,
            "HIDE",
          );
          await f.identity.users.updateProfile(seller.user.id, {
            bio: "Corrected profile",
          });
          assert.equal(
            (await f.profiles.profile(seller.user.id)).profileModeration.bio,
            undefined,
          );
          await assert.rejects(
            profiles.change(admin.principal, seller.user.id, {
              field: "BIO",
              action: "HIDE",
              reason: "Stale moderation decision",
              expectedUpdatedAt: changed.updatedAt.toISOString(),
            }),
            /STALE_PROFILE_VERSION/,
          );
          const avatar = await f.db.avatarAsset.create({
            data: {
              userId: seller.user.id,
              storageKey: "fixture/avatar",
              mime: "image/png",
              byteSize: 1024n,
              checksum: "a".repeat(64),
              state: "QUARANTINED",
            },
          });
          current = await profiles.read(admin.principal, seller.user.id);
          await profiles.change(admin.principal, seller.user.id, {
            field: "AVATAR",
            action: "HIDE",
            reason: "Avatar violates policy",
            expectedUpdatedAt: current.updatedAt.toISOString(),
          });
          assert.equal(
            (
              await f.db.avatarAsset.findUniqueOrThrow({
                where: { id: avatar.id },
              })
            ).state,
            "DELETED",
          );
          assert.equal(
            await f.db.auditLog.count({
              where: { targetId: seller.user.id, action: "PROFILE_HIDE" },
            }),
            2,
          );
        },
      );
      await t.test(
        "review hiding/restoring changes public stars, leaves reputation and rolls back on audit failure",
        async () => {
          const proposal = await f.db.proposal.create({
            data: {
              sourceType: "DIRECT_SEARCH",
              targetSharingSkillId: "00000000-0000-4000-8000-000000000001",
              expiresAt: new Date(Date.now() + 86400000),
              proposerId: seller.user.id,
              recipientId: buyer.user.id,
              skillId: f.skill.id,
              message: "Review fixture",
              status: "ACCEPTED",
            },
          });
          const conversation = await f.db.conversation.create({
            data: {
              proposalId: proposal.id,
              participantAId: seller.user.id,
              participantBId: buyer.user.id,
            },
          });
          const path = await f.db.learningPath.create({
            data: {
              conversationId: conversation.id,
              participantAId: seller.user.id,
              participantBId: buyer.user.id,
              status: "ACTIVE",
              currentVersion: 1,
            },
          });
          const policy = await f.db.feePolicyVersion.findFirstOrThrow({
            where: { policyCode: "ONE_WAY" },
          });
          await f.db.learningPathVersion.create({
            data: {
              pathId: path.id,
              versionNo: 1,
              exchangeType: "ONE_WAY",
              negotiatedCredit: 1000n,
              teacherId: seller.user.id,
              learnerId: buyer.user.id,
              createdByUserId: seller.user.id,
            },
          });
          const operation = await f.db.creditOperation.create({
            data: {
              operationType: "READ_COUNT_FIXTURE",
              referenceType: "LEARNING_PATH",
              referenceId: path.id,
              idempotencyKey: randomUUID(),
              status: "SUCCESS",
            },
          });
          await f.db.learningPath.update({
            where: { id: path.id },
            data: {
              status: "COMPLETED",
              settledAt: new Date(),
              settledPathVersion: 1,
              settlementOperationId: operation.id,
              settlementFeePolicyId: policy.id,
              settlementExchangeType: "ONE_WAY",
              settlementGrossAmount: 1000n,
              settlementFeeAmount: 40n,
              settlementFeeSnapshot: {},
            },
          });
          const review = await f.db.review.create({
            data: {
              pathId: path.id,
              reviewerId: buyer.user.id,
              revieweeId: seller.user.id,
              rating: 5,
              comment: "Review to moderate",
            },
          });
          const reviews = new ReviewModerationService(
            f.transactions,
            f.identity.sessions,
            f.identity.audit,
          );
          const publicReviews = new PublicReviewsService(
            f.transactions,
            f.identity.users,
            {},
          );
          const before = await f.db.user.findUniqueOrThrow({
            where: { id: seller.user.id },
          });
          await reviews.change(admin.principal, review.id, {
            hidden: true,
            expectedVersion: 0,
            reason: "Review violates policy",
          });
          assert.equal(
            (await publicReviews.summary(seller.user.id)).reviewCount,
            0,
          );
          assert.equal(
            (await publicReviews.page(seller.user.id, {})).data.length,
            0,
          );
          await assert.rejects(
            reviews.change(admin.principal, review.id, {
              hidden: false,
              expectedVersion: 0,
              reason: "Stale restore",
            }),
            /STALE_REVIEW_VERSION/,
          );
          await reviews.change(admin.principal, review.id, {
            hidden: false,
            expectedVersion: 1,
            reason: "Review restored after check",
          });
          assert.equal(
            (await publicReviews.summary(seller.user.id)).averageRating,
            5,
          );
          assert.equal(
            (
              await f.db.user.findUniqueOrThrow({
                where: { id: seller.user.id },
              })
            ).reputationScore,
            before.reputationScore,
          );
          assert.equal(
            await f.db.reputationHistory.count({
              where: { sourceId: review.id },
            }),
            0,
          );
          const failed = new ReviewModerationService(
            f.transactions,
            f.identity.sessions,
            {
              append: async () => {
                throw new Error("review audit failed");
              },
            },
          );
          await assert.rejects(
            failed.change(admin.principal, review.id, {
              hidden: true,
              expectedVersion: 2,
              reason: "Rollback review hide",
            }),
            /review audit failed/,
          );
          assert.equal(
            (await f.db.review.findUniqueOrThrow({ where: { id: review.id } }))
              .hiddenAt,
            null,
          );
          assert.equal(
            (await f.profiles.profile(seller.user.id))
              .completedLearningPathCount,
            1,
          );
        },
      );
      await t.test(
        "scheduled material fee does not affect purchases before its effective time",
        async () => {
          const scheduled = await f.db.feePolicyVersion.findFirstOrThrow({
            where: { policyCode: "MATERIAL_PAID", versionNo: 3 },
          });
          const effectiveAt = new Date(Date.now() + 3600000).toISOString();
          await fees.approve(admin.principal, scheduled.id, {
            effectiveAt,
            reason: "Scheduled next fee version",
            reauthToken: await proof(),
          });
          const freshBuyer = await f.account();
          await f.fund(freshBuyer, 10000n);
          const order = await f.purchases.purchase(
            freshBuyer.principal,
            item.id,
            item.listingVersion,
            randomUUID(),
          );
          assert.equal(order.order.feeAmount, "1.00");
          const listed = await fees.list(admin.principal, { limit: 100 });
          assert.equal(
            listed.data.find((row) => row.id === scheduled.id).effective,
            false,
          );
          assert.equal(
            listed.data.find((row) => row.id === draft.id).effective,
            true,
          );
          const next = await fees.create(admin.principal, {
            versionNo: 4,
            feeBps: 600,
            reason: "Later draft fee",
            reauthToken: await proof(),
          });
          await assert.rejects(
            fees.approve(admin.principal, next.id, {
              effectiveAt: new Date(Date.now() - 1000).toISOString(),
              reason: "Cannot backdate fees",
              reauthToken: await proof(),
            }),
            /FEE_POLICY_EFFECTIVE_TIME_IN_PAST/,
          );
          await assert.rejects(
            fees.approve(admin.principal, next.id, {
              reason: "Cannot supersede future version early",
              reauthToken: await proof(),
            }),
            /FEE_POLICY_EFFECTIVE_ORDER_CONFLICT/,
          );
        },
      );
    } finally {
      await f.dispose();
    }
  },
);
