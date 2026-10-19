import { pathToFileURL } from "node:url";

export async function triggerDeployment({ webhook, token }, request = fetch) {
  const url = new URL(webhook);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.hash ||
    !url.pathname.endsWith("/api/v1/deploy") ||
    url.searchParams.has("tag") ||
    url.searchParams.getAll("uuid").length !== 1 ||
    !/^[a-zA-Z0-9]+$/.test(url.searchParams.get("uuid") ?? "") ||
    !token
  )
    throw new Error(
      "Configure an authenticated webhook for one Coolify application",
    );
  const response = await request(url.href, {
    method: "GET",
    redirect: "error",
    signal: AbortSignal.timeout(15000),
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok)
    throw new Error(`Coolify rejected deployment (${response.status})`);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    await triggerDeployment({
      webhook: process.env.COOLIFY_API_WEBHOOK,
      token: process.env.COOLIFY_TOKEN,
    });
    console.log(
      "Coolify accepted the deployment request. Verify its deployment logs and readiness in Coolify.",
    );
  } catch {
    console.error(
      "Deployment request failed. Check the API webhook, token and Coolify availability.",
    );
    process.exitCode = 1;
  }
}
