import { test } from "node:test";
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { createSkillFixture } from "./helpers.mjs";

test(
  "SC-005 search p95 with 10k catalog and 100k sharing rows",
  { timeout: 180000 },
  async (t) => {
    const f = await createSkillFixture();
    try {
      const users = [];
      for (let i = 0; i < 10; i++) users.push(await f.account());
      await f.client
        .query(`INSERT INTO skills(skill_id,name,name_key,slug,status)
      SELECT gen_random_uuid(),'Benchmark skill '||n,'benchmark skill '||n,'benchmark-'||n,'ACTIVE' FROM generate_series(1,10000) n`);
      await f.client.query(
        `INSERT INTO sharing_skills(sharing_skill_id,user_id,skill_id,level,description,verification_status,is_visible)
      SELECT gen_random_uuid(),u.id,s.skill_id,'ADVANCED','A valid teaching description for search benchmarks','UNVERIFIED',true
      FROM skills s CROSS JOIN unnest($1::uuid[]) u(id)`,
        [users.map((row) => row.user.id)],
      );
      await f.client.query("ANALYZE skills");
      await f.client.query("ANALYZE sharing_skills");
      const { rows } = await f.client.query(
        "SELECT skill_id FROM skills ORDER BY skill_id LIMIT 1",
      );
      const id = rows[0].skill_id;
      const samples = [];
      for (let i = 0; i < 32; i++) {
        const start = performance.now();
        const result = await f.sharing.search(users[0].principal, id, {
          limit: 20,
        });
        assert.equal(result.data.length, 10);
        if (i >= 2) samples.push(performance.now() - start);
      }
      samples.sort((a, b) => a - b);
      const p95 = samples[Math.ceil(samples.length * 0.95) - 1];
      t.diagnostic(
        `rows=10000/100000 samples=30 search p95=${p95.toFixed(1)} ms`,
      );
      const explain = await f.client.query(
        "EXPLAIN (ANALYZE, BUFFERS) SELECT sharing_skill_id FROM sharing_skills WHERE skill_id=$1 AND archived_at IS NULL AND is_visible=true ORDER BY sharing_skill_id LIMIT 21",
        [id],
      );
      t.diagnostic(explain.rows.map((row) => row["QUERY PLAN"]).join("\n"));
      assert.ok(p95 <= 1000, `Search p95 ${p95.toFixed(1)}ms exceeds SC-005`);
    } finally {
      await f.dispose();
    }
  },
);
