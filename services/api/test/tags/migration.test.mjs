import "reflect-metadata";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createSkillFixture } from "../skills/helpers.mjs";

if (!process.env.TEST_DATABASE_URL)
  throw new Error("TEST_DATABASE_URL required");

const execute = promisify(execFile);
function preflight(schema, verify = false) {
  const url = new URL(process.env.TEST_DATABASE_URL);
  url.searchParams.set("options", `-c search_path=${schema}`);
  return execute(
    process.execPath,
    ["scripts/preflight-tags.mjs", ...(verify ? ["--verify"] : [])],
    {
      cwd: new URL("../../", import.meta.url),
      env: { ...process.env, DATABASE_URL: url.href },
    },
  );
}

test(
  "tag migration preserves legacy labels, ids and unknown creator metadata",
  { timeout: 120000 },
  async () => {
    const ids = [randomUUID(), randomUUID()];
    const ownerId = randomUUID(),
      skillId = randomUUID(),
      requestId = randomUUID();
    const f = await createSkillFixture(undefined, undefined, async (client) => {
      await client.query(
        "INSERT INTO tags(tag_id,label,status) VALUES ($1,$2,'ACTIVE'),($3,'C++','INACTIVE')",
        [ids[0], " Kỹ  NĂNG ", ids[1]],
      );
      await client.query(
        `INSERT INTO users(user_id,role_id,normalized_email,account_status,email_verified,security_version,failed_login_count,terms_version,terms_accepted_at,full_name,locale,verified_skill_count,completed_session_count,updated_at)
        SELECT $1,role_id,$2,'ACTIVE',true,1,0,'integration',CURRENT_TIMESTAMP,'Legacy tag owner','vi',0,0,CURRENT_TIMESTAMP FROM roles WHERE code='USER'`,
        [ownerId, `${ownerId}@fixture.invalid`],
      );
      await client.query(
        "INSERT INTO skills(skill_id,name,name_key,slug,status,updated_at) VALUES ($1,$2,$3,$4,'ACTIVE',CURRENT_TIMESTAMP)",
        [
          skillId,
          `Legacy ${skillId}`,
          `legacy ${skillId}`,
          `legacy-${skillId}`,
        ],
      );
      await client.query(
        "INSERT INTO learning_requests(request_id,owner_id,skill_id,title,description,learning_goal,updated_at) VALUES ($1,$2,$3,'Legacy tagged learning','A historical request whose tag link must survive migration.','Preserve historical tag selection.',CURRENT_TIMESTAMP)",
        [requestId, ownerId, skillId],
      );
      await client.query(
        "INSERT INTO learning_request_tags(request_id,tag_id) VALUES ($1,$2)",
        [requestId, ids[0]],
      );
    });
    try {
      const first = await f.db.tag.findUniqueOrThrow({ where: { id: ids[0] } });
      assert.equal(first.label, " Kỹ  NĂNG ");
      assert.equal(first.labelKey, "kỹ năng");
      assert.equal(first.createdByUserId, null);
      assert.equal(first.createdAt, null);
      assert.equal(first.version, 1);
      assert.equal(
        await f.db.requestTag.count({ where: { requestId, tagId: ids[0] } }),
        1,
      );
      assert.match((await preflight(f.schema, true)).stdout, /"status":"pass"/);
      await f.db.tag.update({
        where: { id: ids[0] },
        data: { labelKey: "incorrect backfill" },
      });
      await assert.rejects(
        preflight(f.schema, true),
        (error) =>
          error.code === 1 && error.stderr.includes("TAG_KEY_MISMATCH"),
      );
      assert.equal(
        (await f.db.tag.findUniqueOrThrow({ where: { id: ids[1] } })).status,
        "INACTIVE",
      );
      const owner = await f.account();
      await assert.rejects(
        f.db.tagCreationRequest.create({
          data: {
            label: "Invalid decision",
            labelKey: "invalid decision",
            requestedByUserId: owner.user.id,
            status: "APPROVED",
          },
        }),
      );
      const data = {
        label: "Pending",
        labelKey: "pending",
        requestedByUserId: owner.user.id,
      };
      await f.db.tagCreationRequest.create({ data });
      await assert.rejects(f.db.tagCreationRequest.create({ data }));
    } finally {
      await f.dispose();
    }
  },
);

test(
  "tag migration fails on normalized duplicates without merging legacy records",
  { timeout: 120000 },
  async () => {
    await assert.rejects(
      createSkillFixture(undefined, undefined, async (client) => {
        await client.query(
          "INSERT INTO tags(tag_id,label,status) VALUES ($1,'JavaScript','ACTIVE'),($2,' javascript ','INACTIVE')",
          [randomUUID(), randomUUID()],
        );
        const { rows } = await client.query(
          "SELECT current_schema() AS schema",
        );
        await assert.rejects(
          preflight(rows[0].schema),
          (error) =>
            error.code === 1 && error.stderr.includes("TAG_LABEL_COLLISION"),
        );
      }),
      /TAG_LABEL_COLLISION/,
    );
  },
);

test(
  "preflight blocks locale casing differences and migration rejects invalid legacy controls",
  { timeout: 120000 },
  async () => {
    await assert.rejects(
      createSkillFixture(undefined, undefined, async (client) => {
        await client.query(
          "INSERT INTO tags(tag_id,label,status) VALUES ($1,$2,'ACTIVE')",
          [randomUUID(), "Invalid\tlabel"],
        );
      }),
      /INVALID_LEGACY_TAG_LABEL/,
    );
    const f = await createSkillFixture();
    try {
      await f.db.tag.create({
        data: { label: "İ", labelKey: "i\u0307", status: "ACTIVE" },
      });
      const result = await f.client.query("SELECT lower(chr(304)) AS key");
      if (result.rows[0].key !== "i\u0307") {
        await assert.rejects(
          preflight(f.schema),
          (error) =>
            error.code === 1 &&
            error.stderr.includes("TAG_SQL_NORMALIZATION_MISMATCH"),
        );
      } else
        assert.match((await preflight(f.schema)).stdout, /"status":"pass"/);
      assert.match((await preflight(f.schema, true)).stdout, /"status":"pass"/);
    } finally {
      await f.dispose();
    }
  },
);
