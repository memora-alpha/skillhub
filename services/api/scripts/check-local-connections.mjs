import pg from "pg";
import { mongo } from "mongoose";
import Redis from "ioredis";

process.loadEnvFile();
const summary = {};
const endpoint = (value, fallback) => {
  const url = new URL(value);
  return {
    host: url.hostname,
    port: url.port || fallback,
    database: url.pathname.slice(1),
  };
};
const failure = (error) => ({ ok: false, code: error.code ?? error.name });
const pgClient = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 5000,
});
try {
  await pgClient.connect();
  const info = (
    await pgClient.query(
      "SELECT current_database() AS database, current_schema() AS schema, version() AS version",
    )
  ).rows[0];
  const migrations = (
    await pgClient.query(
      "SELECT to_regclass('_prisma_migrations') IS NOT NULL AS present",
    )
  ).rows[0];
  const applied = migrations.present
    ? (
        await pgClient.query(
          "SELECT migration_name, finished_at IS NOT NULL AS finished, rolled_back_at IS NOT NULL AS rolled_back FROM _prisma_migrations ORDER BY started_at",
        )
      ).rows
    : [];
  const tables = (
    await pgClient.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema=current_schema() AND table_name IN ('users','proposals','conversations','chat_publications','user_event_streams','user_event_deliveries','stored_files','notifications') ORDER BY table_name",
    )
  ).rows.map((row) => row.table_name);
  summary.postgres = {
    ok: true,
    endpoint: endpoint(process.env.DATABASE_URL, "5432"),
    ...info,
    migrations: applied,
    tables,
    proposalVersionPresent: (
      await pgClient.query(
        "SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='proposals' AND column_name='version') AS present",
      )
    ).rows[0].present,
    configurationCount: (
      await pgClient.query(
        "SELECT count(*)::int AS count FROM system_configurations",
      )
    ).rows[0].count,
    temporaryCheckSchemas: (
      await pgClient.query(
        "SELECT count(*)::int AS count FROM information_schema.schemata WHERE schema_name ~ '^connections_(http|test)_[a-f0-9]+'",
      )
    ).rows[0].count,
    moderationRuleCount:
      (
        await pgClient.query(
          "SELECT jsonb_array_length(value->'rules') AS count FROM system_configurations WHERE config_key='learningRequest.moderationRuleSet'",
        )
      ).rows[0]?.count ?? null,
  };
} catch (error) {
  summary.postgres = {
    ...failure(error),
    endpoint: endpoint(process.env.DATABASE_URL, "5432"),
  };
} finally {
  await pgClient.end().catch(() => {});
}
const mongoClient = new mongo.MongoClient(process.env.MONGODB_URI, {
  serverSelectionTimeoutMS: 5000,
});
try {
  await mongoClient.connect();
  const hello = await mongoClient.db().admin().command({ hello: 1 });
  const db = mongoClient.db(),
    names = (await db.listCollections({}, { nameOnly: true }).toArray()).map(
      (row) => row.name,
    );
  const indexes = names.includes("chat_messages")
    ? await db.collection("chat_messages").listIndexes().toArray()
    : [];
  const collectionIndexes = {};
  for (const name of names.filter((name) => name.startsWith("chat_")))
    collectionIndexes[name] = (
      await db.collection(name).listIndexes().toArray()
    ).map((index) => index.name);
  summary.mongo = {
    ok: true,
    endpoint: endpoint(process.env.MONGODB_URI, "27017"),
    replicaSet: hello.setName ?? null,
    writablePrimary: hello.isWritablePrimary,
    collections: names,
    indexes: indexes.map((row) => ({
      name: row.name,
      key: row.key,
      unique: row.unique ?? false,
    })),
    collectionIndexes,
    temporaryCheckDatabases: (
      await db.admin().command({ listDatabases: 1, nameOnly: true })
    ).databases.filter((database) =>
      /^connections_(http|test)_[a-f0-9]+$/.test(database.name),
    ).length,
  };
} catch (error) {
  summary.mongo = {
    ...failure(error),
    endpoint: endpoint(process.env.MONGODB_URI, "27017"),
  };
} finally {
  await mongoClient.close().catch(() => {});
}
const redis = new Redis(process.env.REDIS_URL, {
  lazyConnect: true,
  connectTimeout: 5000,
  maxRetriesPerRequest: 0,
  retryStrategy: () => null,
});
redis.on("error", () => {});
try {
  await redis.connect();
  summary.redis = {
    ok: (await redis.ping()) === "PONG",
    endpoint: endpoint(process.env.REDIS_URL, "6379"),
  };
} catch (error) {
  summary.redis = failure(error);
} finally {
  redis.disconnect();
}
summary.providers = {
  storageEnabled: process.env.STORAGE_ENABLED === "true",
  clamavConfigured: Boolean(process.env.CLAMAV_HOST && process.env.CLAMAV_PORT),
  smtpConfigured: Boolean(process.env.SMTP_HOST),
};
try {
  const base = `http://127.0.0.1:${process.env.PORT || 3001}`;
  const health = await fetch(base + "/api/health", {
    signal: AbortSignal.timeout(5000),
  });
  const ready = await fetch(base + "/api/health/ready", {
    signal: AbortSignal.timeout(5000),
  });
  summary.http = {
    ok: health.ok,
    health: health.status,
    ready: ready.status,
    readiness: await ready.json(),
  };
  summary.http.routes = [];
  for (const [path, expectedStatus] of [
    ["/api/v1/skills", 200],
    ["/api/v1/proposals", 401],
    ["/api/v1/conversations", 401],
    ["/api/v1/notifications", 401],
    ["/api/v1/events", 401],
    ["/api/v1/learning-requests", 401],
  ]) {
    const response = await fetch(base + path, {
      signal: AbortSignal.timeout(5000),
    });
    await response.arrayBuffer();
    summary.http.routes.push({
      path,
      status: response.status,
      expectedStatus,
      ok: response.status === expectedStatus,
    });
  }
} catch (error) {
  summary.http = failure(error);
}
console.log(JSON.stringify(summary, null, 2));
