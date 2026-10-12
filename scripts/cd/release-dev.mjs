import { spawnSync } from "node:child_process";
import { isAbsolute } from "node:path";
import { pathToFileURL } from "node:url";
import { deployImage, verifyApplication } from "./coolify.mjs";

export function docker(args, capture = false, spawn = spawnSync) {
  // The Linux release runner uses a root-owned CLI; never resolve it through PATH.
  const result = spawn("/usr/bin/docker", args, {
    stdio: capture ? "pipe" : "inherit",
    encoding: "utf8",
    env: { ...process.env, PATH: "/usr/bin:/bin" },
  });
  if (result.error || result.status !== 0)
    throw new Error("Docker release command failed");
  return result.stdout?.trim();
}

export async function runHostRelease(
  {
    config,
    envFile,
    network,
    volume,
    sha,
    seed = "none",
    operation = "deploy",
  },
  {
    runDocker = docker,
    verify = verifyApplication,
    deploy = deployImage,
    log = console.log,
  } = {},
) {
  if (
    !isAbsolute(envFile ?? "") ||
    !/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(network ?? "") ||
    !/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(volume ?? "") ||
    !/^[a-f0-9]{40}$/.test(sha ?? "") ||
    !["none", "identity", "configuration", "both"].includes(seed) ||
    !["deploy", "seed-only"].includes(operation) ||
    (operation === "seed-only" && seed === "none")
  )
    throw new Error("Invalid release runner configuration");
  // Verify the deployment target before touching any database.
  await verify(config);
  const image = `${config.imageName}@${config.imageDigest}`;
  runDocker(["pull", image]);
  const revision = runDocker(
    [
      "image",
      "inspect",
      "--format",
      '{{index .Config.Labels "org.opencontainers.image.revision"}}',
      image,
    ],
    true,
  );
  if (revision !== sha)
    throw new Error("Image revision does not match release commit");
  // A stopped container is a server-side lock. Cancellation leaves it for operator inspection.
  const lock = `skillhub-release-lock-${config.applicationUuid}`;
  runDocker(
    [
      "create",
      "--name",
      lock,
      "--label",
      `skillhub.release.sha=${sha}`,
      image,
      "node",
      "-e",
      "process.exit(0)",
    ],
    true,
  );
  runDocker([
    "run",
    "--rm",
    "--init",
    "--network",
    network,
    "--env-file",
    envFile,
    "--mount",
    `type=volume,source=${volume},target=/release-state`,
    "--env",
    "RELEASE_STATE_DIRECTORY=/release-state",
    "--env",
    `RELEASE_SEED=${seed}`,
    "--env",
    `RELEASE_OPERATION=${operation}`,
    "--entrypoint",
    "node",
    image,
    "scripts/release.mjs",
  ]);
  if (operation === "deploy") {
    const uuid = await deploy(config);
    log(`Release ${sha} completed; deployment ${uuid} is ready.`);
  } else
    log(
      `Requested seed completed using release ${sha}; API deployment unchanged.`,
    );
  // Never silently unlock a failed/timed-out release whose remote deployment may still run.
  runDocker(["rm", lock], true);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    await runHostRelease({
      config: {
        apiUrl: process.env.COOLIFY_API_URL,
        token: process.env.COOLIFY_TOKEN,
        applicationUuid: process.env.COOLIFY_API_UUID,
        imageName: process.env.IMAGE_NAME,
        imageDigest: process.env.IMAGE_DIGEST,
        readinessUrl: process.env.API_READINESS_URL,
      },
      envFile: process.env.RELEASE_ENV_FILE,
      network: process.env.RELEASE_DOCKER_NETWORK,
      volume: process.env.RELEASE_STATE_VOLUME,
      sha: process.env.RELEASE_SHA,
      seed: process.env.RELEASE_SEED ?? "none",
      operation: process.env.RELEASE_OPERATION ?? "deploy",
    });
  } catch {
    // Do not print fetch/spawn exceptions or provider responses containing secrets.
    console.error(
      "Release failed. Inspect the release lock, database steps and Coolify deployment before unlocking or retrying.",
    );
    process.exitCode = 1;
  }
}
