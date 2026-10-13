import assert from "node:assert/strict";
import { test } from "node:test";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../dist/generated/prisma/client.js";
import { postgresConnectionString } from "../dist/infrastructure/database/postgres-connection.js";

test("runtime PostgreSQL options enforce UTC and preserve credentials, TLS and other session settings", () => {
  const original = new URL(
    "postgresql://user:private%2Fpassword@localhost:5433/skillhub?sslmode=verify-full&options=-c%20statement_timeout%3D9000%20-c%20timezone%3DAsia%2FBangkok",
  );
  const connectionString = postgresConnectionString(
    original.toString(),
    "-c lock_timeout=5000",
  );
  const current = new URL(connectionString);
  assert.equal(current.username, original.username);
  assert.equal(current.password, original.password);
  assert.equal(current.host, original.host);
  assert.equal(current.pathname, original.pathname);
  assert.equal(current.searchParams.get("sslmode"), "verify-full");
  const client = new pg.Client({ connectionString });
  assert.equal(
    client.connectionParameters.options,
    "-c statement_timeout=9000 -c timezone=Asia/Bangkok -c timezone=UTC",
  );
});

test("PGOPTIONS is preserved when the URL does not override session options", () => {
  const current = new URL(
    postgresConnectionString(
      "postgresql://user:password@localhost/skillhub",
      "-c statement_timeout=10000 -c timezone=Asia/Bangkok",
    ),
  );
  assert.equal(
    current.searchParams.get("options"),
    "-c statement_timeout=10000 -c timezone=Asia/Bangkok -c timezone=UTC",
  );
});

test("malformed connection settings fail without exposing credentials", () => {
  for (const input of [
    "private-password",
    "https://user:private-password@localhost/skillhub",
  ])
    assert.throws(
      () => postgresConnectionString(input),
      (error) => {
        assert.equal(
          error.message,
          "Invalid PostgreSQL connection configuration",
        );
        assert.doesNotMatch(error.message, /private-password/);
        return true;
      },
    );
});

test(
  "Prisma reads UTC+7 timestamptz as the correct instant with a UTC session",
  {
    skip: !process.env.TEST_POSTGRES_URL,
  },
  async () => {
    const prisma = new PrismaClient({
      adapter: new PrismaPg({
        connectionString: postgresConnectionString(
          process.env.TEST_POSTGRES_URL,
        ),
      }),
    });
    try {
      const rows = await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
        return tx.$queryRaw`SELECT current_setting('TimeZone') AS zone, '2026-10-12 23:29:10.915+07'::timestamptz AS effective_at, CURRENT_TIMESTAMP AS server_now`;
      });
      assert.equal(rows[0].zone, "UTC");
      assert.equal(
        rows[0].effective_at.toISOString(),
        "2026-10-12T16:29:10.915Z",
      );
      assert.ok(Math.abs(rows[0].server_now.getTime() - Date.now()) < 5000);
    } finally {
      await prisma.$disconnect();
    }
  },
);
