import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { test } from "node:test";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../dist/generated/prisma/client.js";
import { OutboxWriter } from "../dist/infrastructure/events/outbox-writer.js";
import { OutboxDispatcher } from "../dist/infrastructure/events/outbox-dispatcher.js";
import { OutboxPublisherRegistry } from "../dist/infrastructure/events/outbox.types.js";

const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
test(
  "v3 migration preserves identity, foundation and learning request data and constraints",
  {
    skip:
      !url &&
      "A PostgreSQL connection is required; test uses only a disposable schema",
    timeout: 60000,
  },
  async () => {
    const schema = `runtime_v3_test_${randomUUID().replaceAll("-", "")}`;
    const client = new pg.Client({
      connectionString: url,
      connectionTimeoutMillis: 5000,
    });
    await client.connect();
    let created = false;
    try {
      await client.query(`CREATE SCHEMA "${schema}"`);
      created = true;
      await client.query(`SET search_path TO "${schema}"`);
      const root = new URL("../prisma/migrations/", import.meta.url);
      for (const name of (await readdir(root))
        .filter((name) => /^2026/.test(name))
        .sort()) {
        if (name === "20261007000000_runtime_v3") break;
        await client.query(
          await readFile(new URL(`${name}/migration.sql`, root), "utf8"),
        );
      }
      const user = randomUUID(),
        userRole = randomUUID(),
        staff = randomUUID(),
        admin = randomUUID();
      const audit = randomUUID(),
        event = randomUUID();
      const category = randomUUID(),
        skill = randomUUID(),
        tag = randomUUID(),
        request = randomUUID(),
        notification = randomUUID();
      const uninitialized = randomUUID();
      await client.query(
        `INSERT INTO roles(id,code,description) VALUES ($1,'USER','USER'),($2,'STAFF','STAFF'),($3,'ADMIN','ADMIN')`,
        [userRole, staff, admin],
      );
      await client.query(
        `INSERT INTO users(id,normalized_email,password_hash,terms_version,terms_accepted_at,updated_at)
      VALUES ($1,'migration@example.com','retained-password-hash','fixture-v1',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
        [user],
      );
      await client.query(
        `INSERT INTO profiles(user_id,full_name,headline,bio,timezone,locale,reputation_score,verified_skill_count,completed_session_count,updated_at)
      VALUES ($1,'Migration User','Headline','Biography','Asia/Ho_Chi_Minh','vi',72,3,8,CURRENT_TIMESTAMP)`,
        [user],
      );
      await client.query(
        `INSERT INTO user_roles(user_id,role_id) VALUES ($1,$2),($1,$3),($1,$4)`,
        [user, userRole, staff, admin],
      );
      await client.query(
        `INSERT INTO users(id,normalized_email,terms_version,terms_accepted_at,updated_at)
        VALUES ($1,'uninitialized@example.com','fixture-v1',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
        [uninitialized],
      );
      await client.query(
        `INSERT INTO profiles(user_id,full_name,updated_at) VALUES ($1,'Uninitialized User',CURRENT_TIMESTAMP)`,
        [uninitialized],
      );
      await client.query(
        `INSERT INTO audit_logs(id,actor_id,actor_role,action,target_type,target_id,before,after)
      VALUES ($1,$2,'ADMIN','FIXTURE','User',$3,'{"old":true}','{"new":true}')`,
        [audit, user, user],
      );
      await client.query(
        `INSERT INTO outbox_events(event_id,type,version,payload,correlation_id)
      VALUES ($1,'test.migration',1,'{"retained":true}',$1)`,
        [event],
      );
      await client.query(
        `INSERT INTO skill_categories(category_id,name,slug,status) VALUES ($1,'Migration category','migration-category','ACTIVE')`,
        [category],
      );
      await client.query(
        `INSERT INTO skills(skill_id,name,slug,category_id,status) VALUES ($1,'Migration skill','migration-skill',$2,'ACTIVE')`,
        [skill, category],
      );
      await client.query(
        `INSERT INTO tags(tag_id,label,status) VALUES ($1,'Migration tag','ACTIVE')`,
        [tag],
      );
      await client.query(
        `INSERT INTO learning_requests(request_id,owner_id,skill_id,title,description,learning_goal,
          preferred_slots,current_level,verified_teacher_only,status,moderation_status,reject_reason,
          flagged_rules,moderation_rule_set_version,moderation_reviewed_version,reviewed_by_user_id,
          reviewed_at,requested_expires_at,expires_at,expiry_mode,published_at,content_version,updated_at)
        VALUES ($1,$2,$3,'Learn migration safety','A detailed request that survives the v3 upgrade.',
          'Preserve request lifecycle data.',
          '[{"startAt":"2026-12-01T10:00:00Z","endAt":"2026-12-01T11:00:00Z"}]',
          'BEGINNER',true,'REJECTED','REJECTED','Please clarify the learning goal',
          '["review-category"]',4,2,$2,'2026-10-07T00:00:00Z',
          '2026-12-01T00:00:00Z','2026-12-01T00:00:00Z','CUSTOM','2026-10-06T00:00:00Z',3,CURRENT_TIMESTAMP)`,
        [request, user, skill],
      );
      await client.query(
        `INSERT INTO learning_request_tags(request_id,tag_id) VALUES ($1,$2)`,
        [request, tag],
      );
      await client.query(
        `INSERT INTO notifications(notification_id,user_id,type,title,body,payload,channel,read_at)
        VALUES ($1,$2,'LEARNING_REQUEST_REJECTED','Request update','Please clarify the learning goal',
          jsonb_build_object('requestId',$3::text),'IN_APP','2026-10-07T01:00:00Z')`,
        [notification, user, request],
      );
      const retainedTables = [
        "skill_categories",
        "skills",
        "tags",
        "learning_requests",
        "learning_request_tags",
        "notifications",
      ];
      const beforeLearningRequest = new Map();
      for (const table of retainedTables)
        beforeLearningRequest.set(
          table,
          (await client.query(`SELECT * FROM "${table}"`)).rows,
        );
      const requestChecks = (
        await client.query(
          `SELECT conname,pg_get_constraintdef(oid) AS definition FROM pg_constraint
          WHERE conrelid='learning_requests'::regclass AND contype='c' ORDER BY conname`,
        )
      ).rows;
      assert.equal(requestChecks.length, 11);
      await client.query(
        await readFile(
          new URL("20261007000000_runtime_v3/migration.sql", root),
          "utf8",
        ),
      );
      for (const table of retainedTables)
        assert.deepEqual(
          (await client.query(`SELECT * FROM "${table}"`)).rows,
          beforeLearningRequest.get(table),
          `${table} data changed during v3 upgrade`,
        );
      assert.deepEqual(
        (
          await client.query(
            `SELECT conname,pg_get_constraintdef(oid) AS definition FROM pg_constraint
          WHERE conrelid='learning_requests'::regclass AND contype='c' ORDER BY conname`,
          )
        ).rows,
        requestChecks,
      );
      const draft = (
        await client.query(
          `INSERT INTO learning_requests(request_id,owner_id,skill_id,title,description,learning_goal,updated_at)
          VALUES ($1,$2,$3,'Default request','A detailed request using retained defaults.','Verify request defaults.',CURRENT_TIMESTAMP)
          RETURNING *`,
          [randomUUID(), user, skill],
        )
      ).rows[0];
      assert.equal(draft.status, "DRAFT");
      assert.equal(draft.moderation_status, "NOT_REQUIRED");
      assert.equal(draft.verified_teacher_only, false);
      assert.equal(draft.content_version, 1);
      assert.equal(draft.expiry_mode, "DEFAULT");
      assert.deepEqual(draft.preferred_slots, []);
      await assert.rejects(
        client.query(
          `UPDATE learning_requests SET title='short' WHERE request_id=$1`,
          [request],
        ),
        /learning_requests_title_check/,
      );
      await assert.rejects(
        client.query(
          `UPDATE learning_requests SET preferred_slots='[{}, {}, {}, {}, {}, {}]' WHERE request_id=$1`,
          [request],
        ),
        /learning_requests_preferred_slots_check/,
      );
      await assert.rejects(
        client.query(
          `UPDATE learning_requests SET requested_expires_at=NULL WHERE request_id=$1`,
          [request],
        ),
        /learning_requests_requested_expiry_mode_check/,
      );
      const ownerForeignKey = (
        await client.query(
          `SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint
          WHERE conrelid='learning_requests'::regclass AND conname='learning_requests_owner_id_fkey'`,
        )
      ).rows[0].definition;
      assert.match(ownerForeignKey, /REFERENCES users\(user_id\)/);
      await assert.rejects(
        client.query(
          `UPDATE learning_requests SET owner_id=$1 WHERE request_id=$2`,
          [randomUUID(), request],
        ),
        /learning_requests_owner_id_fkey/,
      );
      const {
        rows: [row],
      } = await client.query(
        `SELECT u.*,r.code FROM users u JOIN roles r ON r.role_id=u.role_id WHERE user_id=$1`,
        [user],
      );
      assert.equal(row.password_hash, "retained-password-hash");
      assert.equal(row.full_name, "Migration User");
      assert.equal(row.bio, "Biography");
      assert.equal(row.reputation_score, 72);
      assert.equal(row.verified_skill_count, 3);
      assert.equal(row.completed_session_count, 8);
      assert.equal(row.code, "ADMIN");
      const fallback = (
        await client.query(
          `SELECT u.reputation_score,r.code FROM users u JOIN roles r ON r.role_id=u.role_id WHERE user_id=$1`,
          [uninitialized],
        )
      ).rows[0];
      assert.equal(fallback.reputation_score, 50);
      assert.equal(fallback.code, "USER");
      assert.equal(
        (
          await client.query(
            `SELECT count(*)::int AS count FROM "${schema}_legacy_v3".user_roles`,
          )
        ).rows[0].count,
        3,
      );
      const retainedAudit = (
        await client.query(`SELECT * FROM audit_logs WHERE audit_id=$1`, [
          audit,
        ])
      ).rows[0];
      assert.deepEqual(retainedAudit.before_data, { old: true });
      assert.equal(retainedAudit.actor_role, "ADMIN");
      const retainedEvent = (
        await client.query(`SELECT * FROM outbox_events WHERE event_id=$1`, [
          event,
        ])
      ).rows[0];
      assert.equal(retainedEvent.event_type, "test.migration");
      assert.equal(retainedEvent.dedupe_key, event);
      assert.deepEqual(retainedEvent.payload, { retained: true });
      const prisma = new PrismaClient({
        adapter: new PrismaPg(
          {
            connectionString: url,
            options: `-c search_path=${schema}`,
          },
          { schema },
        ),
      });
      try {
        const written = randomUUID();
        await prisma.$transaction((tx) =>
          new OutboxWriter().append(tx, {
            eventId: written,
            type: "test.runtime-v3",
            version: 1,
            payload: { retained: true },
            correlationId: written,
          }),
        );
        const published = [];
        const registry = new OutboxPublisherRegistry();
        for (const type of ["test.migration", "test.runtime-v3"])
          registry.register(type, {
            publish: async (message) => published.push(message.eventId),
          });
        const dispatcher = new OutboxDispatcher(prisma, registry);
        assert.equal(await dispatcher.dispatchBatch(), 2);
        assert.deepEqual(published.sort(), [event, written].sort());
        assert.ok(
          (
            await prisma.outboxEvent.findUniqueOrThrow({
              where: { eventId: written },
            })
          ).deliveredAt,
        );
        await dispatcher.onModuleDestroy();
      } finally {
        await prisma.$disconnect();
      }
      await assert.rejects(
        client.query(
          `UPDATE audit_logs SET reason='mutated' WHERE audit_id=$1`,
          [audit],
        ),
        /append-only/,
      );
      assert.equal(
        (
          await client.query(
            `SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema=$1 AND table_type='BASE TABLE'`,
            [schema],
          )
        ).rows[0].count,
        57,
      );
    } finally {
      await client.query("ROLLBACK").catch(() => {});
      if (created) {
        await client.query(
          `DROP SCHEMA IF EXISTS "${schema}_legacy_v3" CASCADE`,
        );
        await client.query(`DROP SCHEMA "${schema}" CASCADE`);
      }
      await client.end();
    }
  },
);
