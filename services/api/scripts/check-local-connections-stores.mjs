import { spawnSync } from "node:child_process";
process.loadEnvFile();
// Explicit local PostgreSQL, disposable schemas only; never fall back in the suite itself.
const local = new URL(process.env.DATABASE_URL);
if (!["127.0.0.1", "localhost", "[::1]"].includes(local.hostname))
  throw new Error("LOCAL_POSTGRES_REQUIRED");
const result = spawnSync(
  process.execPath,
  ["--test", "test/connections/persistence.test.mjs"],
  {
    stdio: "inherit",
    env: { ...process.env, TEST_DATABASE_URL: process.env.DATABASE_URL },
  },
);
process.exit(result.status ?? 1);
