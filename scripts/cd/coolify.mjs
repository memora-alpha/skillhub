import { setTimeout as delay } from "node:timers/promises";

export function validateDeployment(config) {
  const api = new URL(config.apiUrl);
  const ready = new URL(config.readinessUrl);
  if (
    api.protocol !== "https:" ||
    ready.protocol !== "https:" ||
    api.username ||
    api.password ||
    api.search ||
    api.hash ||
    ready.username ||
    ready.password ||
    ready.search ||
    ready.hash ||
    !ready.pathname.endsWith("/api/health/ready") ||
    !api.pathname.endsWith("/api/v1") ||
    !/^[a-zA-Z0-9]+$/.test(config.applicationUuid ?? "") ||
    !/^ghcr\.io\/[a-z0-9][a-z0-9._/-]*$/.test(config.imageName ?? "") ||
    !/^sha256:[a-f0-9]{64}$/.test(config.imageDigest ?? "") ||
    !config.token
  )
    throw new Error("Invalid deployment configuration");
  return {
    ...config,
    digestTag: config.imageDigest.replace("sha256:", "sha256-"),
  };
}

function apiClient(config, request) {
  return async (path, method = "GET", body) => {
    const response = await request(`${config.apiUrl}${path}`, {
      method,
      redirect: "error",
      signal: AbortSignal.timeout(15000),
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok)
      throw new Error(`Coolify request failed (${response.status})`);
    return response.json();
  };
}

export async function verifyApplication(config, request = fetch) {
  const validated = validateDeployment(config);
  const application = await apiClient(
    validated,
    request,
  )(`/applications/${validated.applicationUuid}`);
  if (
    application.git_repository ||
    application.docker_registry_image_name !== validated.imageName
  )
    throw new Error(
      "Coolify must target the configured Docker Image application",
    );
  return validated;
}

export async function deployImage(
  config,
  { request = fetch, sleep = delay, attempts = 120, interval = 10000 } = {},
) {
  const validated = await verifyApplication(config, request);
  const api = apiClient(validated, request);
  await api(`/applications/${validated.applicationUuid}`, "PATCH", {
    docker_registry_image_tag: validated.digestTag,
  });
  const started = await api("/deploy", "POST", {
    uuid: validated.applicationUuid,
  });
  const deployments = started.deployments?.filter(
    (item) => item.resource_uuid === validated.applicationUuid,
  );
  if (
    deployments?.length !== 1 ||
    !/^[a-zA-Z0-9]+$/.test(deployments[0].deployment_uuid ?? "")
  )
    throw new Error("Coolify did not return exactly one deployment UUID");
  const uuid = deployments[0].deployment_uuid;
  let finished = false;
  for (let index = 0; index < attempts; index++) {
    const deployment = await api(`/deployments/${uuid}`);
    if (["failed", "cancelled", "canceled"].includes(deployment.status))
      throw new Error("Coolify deployment failed or was cancelled");
    if (deployment.status === "finished") {
      if (deployment.docker_registry_image_tag !== validated.digestTag)
        throw new Error("Coolify deployed an unexpected image digest");
      finished = true;
      break;
    }
    await sleep(interval);
  }
  if (!finished)
    throw new Error("Coolify deployment timed out; inspect before retrying");
  for (let index = 0; index < attempts; index++) {
    const response = await request(validated.readinessUrl, {
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    }).catch(() => undefined);
    if (response?.ok) {
      const body = await response.json().catch(() => undefined);
      if (
        body?.success === true &&
        body.data?.status === "ok" &&
        ["postgresql", "mongodb", "redis"].every((dependency) =>
          body.data.dependencies?.includes(dependency),
        )
      )
        return uuid;
    }
    await sleep(interval);
  }
  throw new Error("API readiness timed out");
}
