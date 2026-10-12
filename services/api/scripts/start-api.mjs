import { pathToFileURL } from "node:url";
import { runConfiguredRelease } from "./release.mjs";

/** The dev container starts its compiled API only after bootstrap succeeds. */
export async function startDevApi({
  env = process.env,
  release = runConfiguredRelease,
  start = () => import("../dist/main.js"),
} = {}) {
  if (env.NODE_ENV !== "development")
    throw new Error(
      "This bootstrap entrypoint is for development deployments only",
    );
  // Repeated container starts never re-run an operator-selected seed.
  await release({
    env: { ...env, RELEASE_OPERATION: "deploy", RELEASE_SEED: "none" },
  });
  await start();
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    await startDevApi();
  } catch {
    console.error(
      "Dev API bootstrap failed. Check migrations, seed state and environment before redeploying.",
    );
    process.exitCode = 1;
  }
}
