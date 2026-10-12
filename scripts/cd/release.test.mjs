import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { runRelease } from "../../services/api/scripts/release.mjs";
import { deployImage } from "./coolify.mjs";
import { docker, runHostRelease } from "./release-dev.mjs";

const digest = `sha256:${"a".repeat(64)}`;
const config = {
  apiUrl: "https://coolify.example.invalid/api/v1",
  token: "test-token",
  applicationUuid: "api123",
  imageName: "ghcr.io/example/skillhub-api",
  imageDigest: digest,
  readinessUrl: "https://api.example.invalid/api/health/ready",
};
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

function coolifyFixture(statuses = ["in_progress", "finished"]) {
  const calls = [];
  const tag = digest.replace("sha256:", "sha256-");
  return {
    calls,
    async request(url, options) {
      calls.push({ url, ...options });
      let data;
      if (url.includes("/applications/"))
        data = {
          docker_registry_image_name: config.imageName,
          git_repository: null,
        };
      else if (url.endsWith("/deploy"))
        data = {
          deployments: [
            { resource_uuid: "api123", deployment_uuid: "release123" },
          ],
        };
      else if (url.includes("/deployments/"))
        data = { status: statuses.shift(), docker_registry_image_tag: tag };
      else
        data = {
          success: true,
          data: {
            status: "ok",
            dependencies: ["postgresql", "mongodb", "redis"],
          },
        };
      return { ok: true, json: async () => data };
    },
  };
}

test("Coolify is pinned by digest and deployment completion precedes readiness", async () => {
  const fixture = coolifyFixture();
  const uuid = await deployImage(config, {
    ...fixture,
    sleep: async () => {},
    attempts: 3,
  });
  assert.equal(uuid, "release123");
  const patch = fixture.calls.find((call) => call.method === "PATCH");
  assert.equal(
    JSON.parse(patch.body).docker_registry_image_tag,
    digest.replace("sha256:", "sha256-"),
  );
  assert.equal(fixture.calls.at(-1).url, config.readinessUrl);
  assert.equal(fixture.calls.at(-1).headers, undefined);
});

test("failed or timed-out deployment never reports readiness success", async () => {
  for (const statuses of [["failed"], ["in_progress", "in_progress"]]) {
    const fixture = coolifyFixture(statuses);
    await assert.rejects(
      deployImage(config, { ...fixture, sleep: async () => {}, attempts: 2 }),
    );
    assert.equal(
      fixture.calls.some((call) => call.url === config.readinessUrl),
      false,
    );
  }
});

test("wrong Coolify application and unexpected deployed digest fail closed", async () => {
  const fixture = coolifyFixture();
  await assert.rejects(
    deployImage(config, {
      request: async () => ({
        ok: true,
        json: async () => ({ docker_registry_image_name: "other" }),
      }),
    }),
    /configured/,
  );
  await assert.rejects(
    deployImage(config, {
      sleep: async () => {},
      request: async (url, options) => {
        if (url.includes("/deployments/"))
          return {
            ok: true,
            json: async () => ({
              status: "finished",
              docker_registry_image_tag: "latest",
            }),
          };
        return fixture.request(url, options);
      },
    }),
    /unexpected/,
  );
});

test("invalid URLs are rejected without transmitting tokens", async () => {
  let calls = 0;
  await assert.rejects(
    deployImage(
      { ...config, apiUrl: "http://example.invalid/api/v1" },
      {
        request: async () => {
          calls++;
        },
      },
    ),
    /Invalid/,
  );
  assert.equal(calls, 0);
});

test("invalid polling settings fail before any deployment request", async () => {
  let calls = 0;
  const request = async () => {
    calls++;
  };
  await assert.rejects(
    deployImage(config, { request, attempts: 0 }),
    /polling/,
  );
  await assert.rejects(
    deployImage(config, { request, interval: -1 }),
    /polling/,
  );
  assert.equal(calls, 0);
});

test("host migration failure blocks Coolify mutation and retains the release lock", async () => {
  const calls = [];
  let deploys = 0;
  await assert.rejects(
    runHostRelease(
      {
        config,
        envFile: resolve("release.env"),
        network: "coolify",
        volume: "skillhub-dev-state",
        sha: "b".repeat(40),
      },
      {
        verify: async () => {},
        deploy: async () => {
          deploys++;
        },
        log: () => {},
        runDocker: (args) => {
          calls.push(args[0]);
          if (args[0] === "image") return "b".repeat(40);
          if (args[0] === "run") throw new Error("database release failed");
        },
      },
    ),
    /database release failed/,
  );
  assert.equal(deploys, 0);
  assert.deepEqual(calls, ["pull", "image", "create", "run"]);
});

test("host seed-only completes and unlocks without deploying API", async () => {
  const calls = [];
  await runHostRelease(
    {
      config,
      envFile: resolve("release.env"),
      network: "coolify",
      volume: "skillhub-dev-state",
      sha: "b".repeat(40),
      operation: "seed-only",
      seed: "identity",
    },
    {
      verify: async () => {},
      deploy: async () => assert.fail("must not deploy"),
      log: () => {},
      runDocker: (args) => {
        calls.push(args);
        if (args[0] === "image") return "b".repeat(40);
      },
    },
  );
  assert.deepEqual(
    calls.map((args) => args[0]),
    ["pull", "image", "create", "run", "rm"],
  );
  assert(
    calls
      .find((args) => args[0] === "run")
      .includes("RELEASE_OPERATION=seed-only"),
  );
});

test("Docker lookup ignores the inherited executable search path", () => {
  const inheritedPath = process.env.PATH;
  try {
    process.env.PATH = "/untrusted/runner/bin";
    const output = docker(["--version"], true, (executable, args, options) => {
      assert.equal(executable, "/usr/bin/docker");
      assert.deepEqual(args, ["--version"]);
      assert.equal(options.env.PATH, "/usr/bin:/bin");
      assert.equal(options.stdio, "pipe");
      return { status: 0, stdout: "Docker test fixture\n" };
    });
    assert.equal(output, "Docker test fixture");
  } finally {
    if (inheritedPath === undefined) delete process.env.PATH;
    else process.env.PATH = inheritedPath;
  }
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

test("polling waits between probes and retries transient readiness failures", async () => {
  const fixture = coolifyFixture();
  const trace = [];
  let readinessCalls = 0;
  await deployImage(config, {
    attempts: 3,
    interval: 25,
    sleep: async (milliseconds) => {
      assert.equal(milliseconds, 25);
      trace.push("delay");
    },
    request: async (url, options) => {
      if (url.includes("/deployments/")) trace.push("deployment");
      if (url === config.readinessUrl) {
        trace.push("readiness");
        readinessCalls++;
        if (readinessCalls === 1) throw new Error("transient network error");
        if (readinessCalls === 2)
          return {
            ok: true,
            json: async () => ({ success: true, data: { status: "ok" } }),
          };
      }
      return fixture.request(url, options);
    },
  });
  assert.deepEqual(trace, [
    "deployment",
    "delay",
    "deployment",
    "readiness",
    "delay",
    "readiness",
    "delay",
    "readiness",
  ]);
});
