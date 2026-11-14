import pg from "pg";
import { pathToFileURL } from "node:url";
import { postgresConnectionString } from "../dist/infrastructure/database/postgres-connection.js";

export function parseArguments(args, env) {
  if (args.some((value) => value !== "--apply") || args.length > 1)
    throw new Error("Usage: reconcile-material-rating-summaries.mjs [--apply]");
  const connectionString = env.MATERIAL_REVIEW_RECONCILIATION_DATABASE_URL;
  if (!connectionString)
    throw new Error(
      "MATERIAL_REVIEW_RECONCILIATION_DATABASE_URL required; DATABASE_URL is never used",
    );
  return { apply: args[0] === "--apply", connectionString };
}

const aggregateSql = `
  WITH expected AS (
    SELECT m.material_id,
      COUNT(r.review_id)::int AS visible_count,
      COUNT(r.review_id) FILTER (WHERE r.rating = 1)::int AS star_1,
      COUNT(r.review_id) FILTER (WHERE r.rating = 2)::int AS star_2,
      COUNT(r.review_id) FILTER (WHERE r.rating = 3)::int AS star_3,
      COUNT(r.review_id) FILTER (WHERE r.rating = 4)::int AS star_4,
      COUNT(r.review_id) FILTER (WHERE r.rating = 5)::int AS star_5,
      COALESCE(SUM(r.rating), 0)::int AS rating_sum
    FROM materials m
    LEFT JOIN material_reviews r ON r.material_id = m.material_id
      AND r.status = 'VISIBLE' AND r.deleted_at IS NULL
    GROUP BY m.material_id
  )
`;

export async function run(options) {
  const client = new pg.Client({
    connectionString: postgresConnectionString(options.connectionString),
    connectionTimeoutMillis: 5_000,
  });
  await client.connect();
  try {
    const drift = await client.query(`${aggregateSql}
      SELECT e.* FROM expected e
      LEFT JOIN material_rating_summaries s ON s.material_id = e.material_id
      WHERE s.material_id IS NULL
        OR (s.visible_count, s.star_1, s.star_2, s.star_3, s.star_4, s.star_5, s.rating_sum)
          IS DISTINCT FROM
           (e.visible_count, e.star_1, e.star_2, e.star_3, e.star_4, e.star_5, e.rating_sum)
      ORDER BY e.material_id LIMIT 100`);
    if (options.apply) {
      await client.query("BEGIN");
      try {
        await client.query(`${aggregateSql}
          INSERT INTO material_rating_summaries
            (material_id, visible_count, star_1, star_2, star_3, star_4, star_5, rating_sum, updated_at)
          SELECT material_id, visible_count, star_1, star_2, star_3, star_4, star_5,
            rating_sum, CURRENT_TIMESTAMP FROM expected
          ON CONFLICT (material_id) DO UPDATE SET
            visible_count = EXCLUDED.visible_count,
            star_1 = EXCLUDED.star_1,
            star_2 = EXCLUDED.star_2,
            star_3 = EXCLUDED.star_3,
            star_4 = EXCLUDED.star_4,
            star_5 = EXCLUDED.star_5,
            rating_sum = EXCLUDED.rating_sum,
            updated_at = CURRENT_TIMESTAMP`);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
    return {
      mode: options.apply ? "APPLY" : "DRY_RUN",
      driftCountInSample: drift.rowCount ?? 0,
      materialIds: drift.rows.map((row) => row.material_id),
    };
  } finally {
    await client.end();
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const result = await run(parseArguments(process.argv.slice(2), process.env));
  process.stdout.write(`${JSON.stringify(result)}\n`);
}
