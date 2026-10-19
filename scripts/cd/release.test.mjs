import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  runRelease,
  withReleaseLock,
} from "../../services/api/scripts/release.mjs";
import { startDevApi } from "../../services/api/scripts/start-api.mjs";
import { triggerDeployment } from "./deploy-dev.mjs";

test("dev startup completes bootstrap before loading the compiled API", async () => {
  const calls = [];
  await startDevApi({
    env: {
      NODE_ENV: "development",
      RELEASE_SEED: "both",
      RELEASE_OPERATION: "seed-only",
    },
    release: async ({ env }) => {
      assert.equal(env.RELEASE_SEED, "none");
      assert.equal(env.RELEASE_OPERATION, "deploy");
      calls.push("bootstrap");
    },
    start: async () => calls.push("api"),
  });
  assert.deepEqual(calls, ["bootstrap", "api"]);
});

test("bootstrap failure never starts the API", async () => {
  let started = false;
  await assert.rejects(
    startDevApi({
      env: { NODE_ENV: "development" },
      release: async () => {
        throw new Error("migration failed");
      },
      start: async () => {
        started = true;
      },
    }),
    /migration failed/,
  );
  assert.equal(started, false);
});

test("development entrypoint rejects production before running migrations", async () => {
  let bootstraps = 0;
  await assert.rejects(
    startDevApi({
      env: { NODE_ENV: "production" },
      release: async () => {
        bootstraps++;
      },
      start: async () => assert.fail("must not start"),
    }),
    /development deployments only/,
  );
  assert.equal(bootstraps, 0);
});

function lockFixture() {
  const calls = [];
  return {
    calls,
    client: {
      connect: async () => calls.push("connect"),
      query: async (sql, values) => calls.push({ sql, values }),
      end: async () => calls.push("end"),
    },
  };
}

test("database release lock surrounds the task and closes after failure", async () => {
  const { calls, client } = lockFixture();
  await assert.rejects(
    withReleaseLock(
      "postgresql://user@localhost/test?schema=cd_test",
      async () => {
        calls.push("task");
        throw new Error("seed failed");
      },
      () => client,
    ),
    /seed failed/,
  );
  assert.equal(calls[0], "connect");
  assert.equal(calls[1].sql, "SET lock_timeout = '30s'");
  assert.equal(
    calls[2].sql,
    "SELECT pg_advisory_lock(hashtextextended($1, 0))",
  );
  assert.deepEqual(calls[2].values, ["skillhub-dev-bootstrap:cd_test"]);
  assert.deepEqual(calls.slice(3), ["task", "end"]);
});

test("failure to acquire the database lock stops the task", async () => {
  const { client } = lockFixture();
  let closed = false;
  client.query = async () => {
    throw new Error("lock failed");
  };
  client.end = async () => {
    closed = true;
  };
  await assert.rejects(
    withReleaseLock(
      "postgresql://user@localhost/test",
      async () => assert.fail("must not seed"),
      () => client,
    ),
    /lock failed/,
  );
  assert.equal(closed, true);
});

test("seed cannot run while lock acquisition is pending", async () => {
  const { client } = lockFixture();
  const locked = Promise.withResolvers();
  const pending = Promise.withResolvers();
  let ran = false;
  client.query = async (sql) => {
    if (sql.startsWith("SELECT")) {
      pending.resolve();
      await locked.promise;
    }
  };
  const task = withReleaseLock(
    "postgresql://user@localhost/test",
    async () => {
      ran = true;
    },
    () => client,
  );
  await pending.promise;
  assert.equal(ran, false);
  locked.resolve();
  await task;
  assert.equal(ran, true);
});

const webhook =
  "https://coolify.example.invalid/api/v1/deploy?uuid=api123&force=false";

test("webhook requests one application using bearer authentication", async () => {
  await triggerDeployment(
    { webhook, token: "test-token" },
    async (url, options) => {
      assert.equal(url, webhook);
      assert.equal(options.method, "GET");
      assert.equal(options.redirect, "error");
      assert.equal(options.headers.Authorization, "Bearer test-token");
      return { ok: true };
    },
  );
});

test("failed webhook request fails the deploy step", async () => {
  await assert.rejects(
    triggerDeployment({ webhook, token: "test-token" }, async () => ({
      ok: false,
      status: 403,
    })),
    /rejected deployment \(403\)/,
  );
});

test("missing credentials or multi-resource webhook fails before transmitting anything", async () => {
  let calls = 0;
  const request = async () => {
    calls++;
  };
  await assert.rejects(
    triggerDeployment({ webhook, token: "" }, request),
    /Configure/,
  );
  await assert.rejects(
    triggerDeployment(
      {
        webhook: webhook.replace("api123", "api123,other"),
        token: "test-token",
      },
      request,
    ),
    /Configure/,
  );
  await assert.rejects(
    triggerDeployment(
      { webhook: webhook.replace("https:", "http:"), token: "test-token" },
      request,
    ),
    /Configure/,
  );
  assert.equal(calls, 0);
});

const plan = {
  requests: [
    {
      id: "restore-permissions",
      seeds: ["identity"],
      reason: "Add restore grants",
    },
  ],
};

async function releaseFixture(t) {
  const stateDirectory = await mkdtemp(join(tmpdir(), "skillhub-cd-test-"));
  t.after(() => rm(stateDirectory, { recursive: true, force: true }));
  const calls = [];
  return {
    calls,
    options: {
      stateDirectory,
      databaseUrl: "postgresql://user@localhost/isolated_test",
      plan: { requests: [] },
      run: async (kind) => calls.push(kind),
      log: () => {},
    },
  };
}

test("ordinary releases migrate both stores without seeding", async (t) => {
  const { calls, options } = await releaseFixture(t);
  await runRelease(options);
  assert.deepEqual(calls, ["postgres", "mongo"]);
});

test("explicit seed requests run once, survive retries and are scoped per database", async (t) => {
  const { calls, options } = await releaseFixture(t);
  await runRelease({ ...options, plan });
  await runRelease({ ...options, plan });
  assert.deepEqual(calls, [
    "postgres",
    "mongo",
    "identity",
    "postgres",
    "mongo",
  ]);
  calls.length = 0;
  await runRelease({
    ...options,
    plan,
    databaseUrl: "postgresql://user@localhost/another_test",
  });
  assert.deepEqual(calls, ["postgres", "mongo", "identity"]);
});

test("failed seeds remain pending; changed applied requests fail before migration", async (t) => {
  const { calls, options } = await releaseFixture(t);
  await assert.rejects(
    runRelease({
      ...options,
      plan,
      run: async (kind) => {
        calls.push(kind);
        if (kind === "identity") throw new Error("seed failed");
      },
    }),
    /seed failed/,
  );
  calls.length = 0;
  await runRelease({ ...options, plan });
  assert.deepEqual(calls, ["postgres", "mongo", "identity"]);
  calls.length = 0;
  await assert.rejects(
    runRelease({
      ...options,
      plan: { requests: [{ ...plan.requests[0], seeds: ["configuration"] }] },
    }),
    /changed/,
  );
  assert.deepEqual(calls, []);
});

test("manual seed-only does not migrate or apply pending automatic requests", async (t) => {
  const { calls, options } = await releaseFixture(t);
  await runRelease({
    ...options,
    plan,
    operation: "seed-only",
    seed: "configuration",
  });
  assert.deepEqual(calls, ["configuration"]);
  await assert.rejects(
    runRelease({ ...options, operation: "seed-only" }),
    /explicit/,
  );
});

test("migration failure prevents indexes and seeds; invalid plans fail before writes", async (t) => {
  const { calls, options } = await releaseFixture(t);
  await assert.rejects(
    runRelease({
      ...options,
      plan,
      run: async (kind) => {
        calls.push(kind);
        throw new Error("migration failed");
      },
    }),
    /migration failed/,
  );
  assert.deepEqual(calls, ["postgres"]);
  calls.length = 0;
  await assert.rejects(
    runRelease({
      ...options,
      plan: { requests: [{ ...plan.requests[0], seeds: ["demo"] }] },
    }),
    /Invalid/,
  );
  assert.deepEqual(calls, []);
});

test("each seed request is persisted before the next starts, including partial failure retry", async (t) => {
  const { calls, options } = await releaseFixture(t);
  const requests = [
    {
      id: "initial-data",
      seeds: ["identity", "configuration"],
      reason: "Bootstrap definitions",
    },
    { id: "new-permissions", seeds: ["identity"], reason: "Add new grants" },
  ];
  let identityRuns = 0;
  await assert.rejects(
    runRelease({
      ...options,
      plan: { requests },
      run: async (kind) => {
        calls.push(kind);
        if (kind !== "identity" || ++identityRuns !== 2) return;
        const [file] = await readdir(options.stateDirectory);
        const state = JSON.parse(
          await readFile(join(options.stateDirectory, file), "utf8"),
        );
        assert(Object.hasOwn(state.completed, "initial-data"));
        assert.equal(Object.hasOwn(state.completed, "new-permissions"), false);
        throw new Error("second request failed");
      },
    }),
    /second request failed/,
  );
  assert.deepEqual(calls, [
    "postgres",
    "mongo",
    "identity",
    "configuration",
    "identity",
  ]);
  calls.length = 0;
  await runRelease({ ...options, plan: { requests } });
  assert.deepEqual(calls, ["postgres", "mongo", "identity"]);
});

test("seed stages do not overlap while an earlier seed is still pending", async (t) => {
  const { calls, options } = await releaseFixture(t);
  const started = Promise.withResolvers();
  const completion = Promise.withResolvers();
  const release = runRelease({
    ...options,
    seed: "both",
    operation: "seed-only",
    run: async (kind) => {
      calls.push(kind);
      if (kind === "identity") {
        started.resolve();
        await completion.promise;
      }
    },
  });
  await started.promise;
  assert.deepEqual(calls, ["identity"]);
  completion.resolve();
  await release;
  assert.deepEqual(calls, ["identity", "configuration"]);
});
