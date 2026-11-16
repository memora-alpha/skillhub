import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { seedPathFeePolicies } from "../../dist/modules/credit/application/seed-fee-policies.js";
import { createSkillFixture } from "../skills/helpers.mjs";
import { createMaterialFixture } from "./fixture.mjs";

test("material catalog plumbing on isolated PostgreSQL", async (t) => {
  const f = await createMaterialFixture();
  try {
    const owner = await f.account();
    const staff = await f.account("STAFF");
    const admin = await f.account("ADMIN");
    await t.test("roles receive material permissions", () => {
      assert.ok(owner.principal.permissions.includes("material:create:self"));
      assert.ok(owner.principal.permissions.includes("material:access"));
      assert.ok(!owner.principal.permissions.includes("material:moderate"));
      assert.ok(staff.principal.permissions.includes("material:moderate"));
      assert.ok(
        !staff.principal.permissions.includes("material-review:moderate"),
      );
      assert.ok(
        admin.principal.permissions.includes("material-review:moderate"),
      );
    });
    await t.test("MATERIAL_PAID 5% policy is seeded once", async () => {
      // The fixture already seeded once; a second run must be a no-op.
      await f.transactions.run(seedPathFeePolicies);
      const policies = await f.db.feePolicyVersion.findMany({
        where: { policyCode: "MATERIAL_PAID" },
      });
      assert.equal(policies.length, 1);
      assert.deepEqual(policies[0].calculationRule, { feeBps: 500 });
      assert.equal(policies[0].status, "APPROVED");
    });
    const base = {
      ownerId: owner.user.id,
      skillId: f.skill.id,
      title: "Docker basics",
      description: "Ten or more characters",
      listingVersion: 1,
      moderationStatus: "NONE",
      status: "DRAFT",
    };
    await t.test("price must match access type", async () => {
      await assert.rejects(
        f.db.material.create({
          data: {
            ...base,
            id: randomUUID(),
            accessType: "FREE",
            priceCredit: 100n,
          },
        }),
        /materials_price_by_access_check/,
      );
      await assert.rejects(
        f.db.material.create({
          data: {
            ...base,
            id: randomUUID(),
            accessType: "PAID",
            priceCredit: 0n,
          },
        }),
        /materials_price_by_access_check/,
      );
    });
    await t.test(
      "PUBLISHED requires a clean rights-confirmed file",
      async () => {
        await assert.rejects(
          f.db.material.create({
            data: {
              ...base,
              id: randomUUID(),
              accessType: "FREE",
              priceCredit: 0n,
              status: "PUBLISHED",
            },
          }),
          /materials_published_file_check/,
        );
      },
    );
  } finally {
    await f.dispose();
  }
});

test("lifecycle migration holds ambiguous archives and preserves the purchase snapshot", async () => {
  const ownerId = randomUUID();
  const buyerId = randomUUID();
  const skillId = randomUUID();
  const orderId = randomUUID();
  const archivedIds = Array.from({ length: 3 }, () => randomUUID());
  const [deletedDraftId, unsharedId, soldId] = archivedIds;
  const publishedId = randomUUID();
  const materialIds = [...archivedIds, publishedId];
  let beforeMaterials;
  let beforeOrder;

  const fixture = await createSkillFixture(undefined, undefined, undefined, {
    afterMigration: async (client, name) => {
      if (name !== "20261115000000_material_favorites_order_views") return;
      await client.query(
        `INSERT INTO users(user_id,role_id,normalized_email,account_status,email_verified,
          security_version,failed_login_count,terms_version,terms_accepted_at,full_name,
          locale,verified_skill_count,completed_session_count,updated_at)
        SELECT seed.id,role_id,seed.id || '@fixture.invalid','ACTIVE',true,1,0,'test',
          CURRENT_TIMESTAMP,'Legacy material user','vi',0,0,CURRENT_TIMESTAMP
        FROM roles CROSS JOIN unnest($1::uuid[]) AS seed(id) WHERE code='USER'`,
        [[ownerId, buyerId]],
      );
      await client.query(
        `INSERT INTO skills(skill_id,name,name_key,slug,status,updated_at)
        VALUES ($1,'Legacy materials',$2::text,$2::text,'ACTIVE',CURRENT_TIMESTAMP)`,
        [skillId, `legacy-${skillId}`],
      );
      await client.query(
        `INSERT INTO materials(material_id,owner_id,skill_id,title,description,access_type,
          price_credit,storage_key,size_bytes,scan_status,distribution_rights_confirmed_at,
          listing_version,moderation_status,status,updated_at)
        SELECT id,$1,$2,title,'Legacy material fixture',access_type::"MaterialAccessType",
          price_credit,storage_key,CASE WHEN storage_key IS NOT NULL THEN 1024 END,
          CASE WHEN storage_key IS NOT NULL THEN 'CLEAN' END,CURRENT_TIMESTAMP,2,
          moderation_status,status::"MaterialStatus",'2026-11-15T10:00:00Z'
        FROM (VALUES
          ($3::uuid,'Deleted draft','FREE',0,NULL,'NONE','ARCHIVED'),
          ($4::uuid,'Stopped sharing','FREE',0,'fixture/free','APPROVED','ARCHIVED'),
          ($5::uuid,'Archived after sale','PAID',1000,'fixture/replacement','NONE','ARCHIVED'),
          ($6::uuid,'Still published','FREE',0,'fixture/published','APPROVED','PUBLISHED')
        ) AS seed(id,title,access_type,price_credit,storage_key,moderation_status,status)`,
        [ownerId, skillId, deletedDraftId, unsharedId, soldId, publishedId],
      );
      const feeId = randomUUID();
      const operationId = randomUUID();
      await client.query(
        `INSERT INTO fee_policy_versions(policy_id,policy_code,version_no,calculation_rule,rounding_rule,status)
        VALUES ($1,'MATERIAL_PAID',1,'{"feeBps":500}','{}','APPROVED')`,
        [feeId],
      );
      await client.query(
        `INSERT INTO credit_operations(operation_id,operation_type,reference_type,reference_id,idempotency_key,status)
        VALUES ($1,'MATERIAL_PURCHASE','MATERIAL_ORDER',$2::text,$2::text,'SUCCESS')`,
        [operationId, orderId],
      );
      await client.query(
        `INSERT INTO material_orders(order_id,buyer_id,seller_id,material_id,purchased_file_snapshot,
          listing_version,gross_credit,fee_amount,seller_net_credit,fee_policy_id,fee_snapshot,
          operation_id,status,idempotency_key)
        VALUES ($1,$2,$3,$4,'{"storageKey":"fixture/purchased"}',1,1000,50,950,$5,'{}',$6,'SUCCESS',$7)`,
        [
          orderId,
          buyerId,
          ownerId,
          soldId,
          feeId,
          operationId,
          `order:${orderId}`,
        ],
      );
      beforeMaterials = (
        await client.query(
          "SELECT * FROM materials WHERE material_id = ANY($1::uuid[]) ORDER BY material_id",
          [materialIds],
        )
      ).rows;
      beforeOrder = (
        await client.query(
          "SELECT * FROM material_orders WHERE order_id = $1",
          [orderId],
        )
      ).rows[0];
    },
  });

  try {
    const { client, db } = fixture;
    const { rows } = await client.query(
      `SELECT * FROM materials WHERE material_id = ANY($1::uuid[]) ORDER BY material_id`,
      [materialIds],
    );
    assert.equal(rows.length, materialIds.length);
    const originalFields = rows.map(
      ({ deleted_at, legacy_archive_unclassified, ...row }) => {
        assert.equal(deleted_at, null);
        assert.equal(
          legacy_archive_unclassified,
          archivedIds.includes(row.material_id),
        );
        return row;
      },
    );
    assert.deepEqual(originalFields, beforeMaterials);
    assert.deepEqual(
      (
        await client.query(
          "SELECT * FROM material_orders WHERE order_id = $1",
          [orderId],
        )
      ).rows[0],
      beforeOrder,
    );

    // A row inserted by a new writer defaults to a classified archive.
    const fresh = await db.material.create({
      data: {
        ownerId,
        skillId,
        title: "Newly archived",
        description: "New lifecycle writer",
        accessType: "FREE",
        priceCredit: 0n,
        status: "ARCHIVED",
        listingVersion: 1,
        moderationStatus: "NONE",
      },
    });
    assert.equal(fresh.legacyArchiveUnclassified, false);
    assert.equal(fresh.deletedAt, null);
    await assert.rejects(
      client.query(
        "UPDATE materials SET legacy_archive_unclassified = true WHERE material_id = $1",
        [publishedId],
      ),
      /materials_owner_lifecycle_check/,
    );
    await assert.rejects(
      client.query(
        "UPDATE materials SET deleted_at = CURRENT_TIMESTAMP WHERE material_id = $1",
        [publishedId],
      ),
      /materials_owner_lifecycle_check/,
    );
    await assert.rejects(
      client.query(
        "UPDATE materials SET deleted_at = CURRENT_TIMESTAMP WHERE material_id = $1",
        [deletedDraftId],
      ),
      /materials_owner_lifecycle_check/,
    );
  } finally {
    await fixture.dispose();
  }
});
