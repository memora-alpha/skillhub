import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const selections = {
  none: [],
  identity: ["identity"],
  configuration: ["configuration"],
  both: ["identity", "configuration"],
};

export function validateSeedPlan(plan) {
  if (!plan || !Array.isArray(plan.requests))
    throw new Error("Seed plan must contain requests");
  const ids = new Set();
  for (const request of plan.requests) {
    if (
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(request.id ?? "") ||
      ids.has(request.id) ||
      !Array.isArray(request.seeds) ||
      request.seeds.length === 0 ||
      new Set(request.seeds).size !== request.seeds.length ||
      request.seeds.some(
        (seed) => !["identity", "configuration"].includes(seed),
      ) ||
      typeof request.reason !== "string" ||
      !request.reason.trim()
    )
      throw new Error("Invalid or duplicate seed request");
    ids.add(request.id);
  }
  return plan.requests;
}

function fingerprint(request) {
  return createHash("sha256")
    .update(JSON.stringify({ seeds: request.seeds, reason: request.reason }))
    .digest("hex");
}

async function readState(path) {
  try {
    const state = JSON.parse(await readFile(path, "utf8"));
    if (
      !state.completed ||
      typeof state.completed !== "object" ||
      Array.isArray(state.completed)
    )
      throw new Error("Invalid seed state");
    return state;
  } catch (error) {
    if (error.code === "ENOENT") return { completed: {} };
    throw error;
  }
}

function seedStatePath(stateDirectory, databaseUrl) {
  const database = new URL(databaseUrl);
  if (!["postgres:", "postgresql:"].includes(database.protocol))
    throw new Error("PostgreSQL connection required");
  // Password rotation does not re-run seeds. Different databases/schemas get separate state.
  const scope = createHash("sha256")
    .update(
      JSON.stringify([
        database.host,
        database.pathname,
        database.searchParams.get("schema") ?? "public",
      ]),
    )
    .digest("hex");
  return join(stateDirectory, `${scope}.json`);
}

function assertRequestHistory(requests, state) {
  for (const request of requests) {
    if (
      Object.hasOwn(state.completed, request.id) &&
      state.completed[request.id] !== fingerprint(request)
    )
      throw new Error(
        "An applied seed request was changed; append a new request ID",
      );
  }
}

/** Each seed starts after the previous seed succeeds, including operator selections. */
function runSeeds(kinds, { run, log, requestId }) {
  return kinds.reduce(
    (completed, kind) =>
      completed.then(() => {
        log(
          requestId
            ? `Running requested ${kind} seed: ${requestId}`
            : `Running operator-requested ${kind} seed`,
        );
        return run(kind);
      }),
    Promise.resolve(),
  );
}

async function applySeedRequest(
  request,
  { state, statePath, stateDirectory, run, log },
) {
  if (Object.hasOwn(state.completed, request.id)) return;
  await runSeeds(request.seeds, { run, log, requestId: request.id });
  state.completed[request.id] = fingerprint(request);
  await mkdir(stateDirectory, { recursive: true });
  // Persist a completed request before any subsequent request can start.
  const temporary = `${statePath}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(state)}\n`, { mode: 0o600 });
  await rename(temporary, statePath);
}

/** Serialize externally; these seeds are idempotent if a crash precedes the marker. */
export async function runRelease({
  plan,
  stateDirectory,
  databaseUrl,
  seed = "none",
  operation = "deploy",
  run,
  log = console.log,
}) {
  const requests = validateSeedPlan(plan);
  if (
    !Object.hasOwn(selections, seed) ||
    !["deploy", "seed-only"].includes(operation)
  )
    throw new Error("Invalid release operation or seed selection");
  if (operation === "seed-only" && seed === "none")
    throw new Error("Seed-only requires an explicit seed selection");
  const statePath = seedStatePath(stateDirectory, databaseUrl);
  const state = await readState(statePath);
  assertRequestHistory(requests, state);

  if (operation === "deploy") {
    log("Applying PostgreSQL migrations");
    await run("postgres");
    log("Applying MongoDB indexes");
    await run("mongo");
    const context = { state, statePath, stateDirectory, run, log };
    await requests.reduce(
      (completed, request) =>
        completed.then(() => applySeedRequest(request, context)),
      Promise.resolve(),
    );
  }
  await runSeeds(selections[seed], { run, log });
  log("Release database steps completed");
}

function execute(kind) {
  const commands = {
    postgres: [require.resolve("prisma/build/index.js"), "migrate", "deploy"],
    mongo: ["scripts/migrate-chat.mjs"],
    identity: ["scripts/identity-bootstrap.mjs", "seed"],
    configuration: ["dist/seed-configuration.js"],
  };
  // Provider errors may contain credentials. Report the phase without relaying child output.
  const result = spawnSync(process.execPath, commands[kind], {
    encoding: "utf8",
    timeout: 30 * 60 * 1000,
    maxBuffer: 1024 * 1024,
  });
  if (result.error || result.status !== 0)
    throw new Error(
      `Release ${kind} step failed; inspect the database with an operator`,
    );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const plan = JSON.parse(
      await readFile(new URL("../release-seeds.json", import.meta.url), "utf8"),
    );
    await runRelease({
      plan,
      stateDirectory: process.env.RELEASE_STATE_DIRECTORY ?? "/release-state",
      databaseUrl: process.env.DATABASE_URL,
      seed: process.env.RELEASE_SEED ?? "none",
      operation: process.env.RELEASE_OPERATION ?? "deploy",
      run: execute,
    });
  } catch {
    console.error(
      "Release database steps failed; deployment must stop. Check the plan, state and database.",
    );
    process.exitCode = 1;
  }
}
