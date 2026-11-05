export class GatewayError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export type BackendReply = {
  status: number;
  value: { success: boolean; data?: unknown; message?: unknown } | null;
};

export function backendBaseUrl() {
  // Read legacy public configuration at runtime too, rather than inlining the
  // address that happened to be present when Next built the server bundle.
  const environment = process.env;
  const configured =
    environment.SKILLHUB_API_URL ??
    environment.NEXT_PUBLIC_API_URL ??
    environment.EXPO_PUBLIC_API_URL;
  if (configured === undefined && environment.NODE_ENV === "production")
    throw new GatewayError(503, "API_CONFIGURATION_INVALID");
  let url: URL;
  try {
    url = new URL(configured ?? "http://localhost:3001/api/v1");
  } catch {
    throw new GatewayError(503, "API_CONFIGURATION_INVALID");
  }
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new GatewayError(503, "API_CONFIGURATION_INVALID");
  let end = url.pathname.length;
  while (end > 0 && url.pathname[end - 1] === "/") end--;
  url.pathname = url.pathname.slice(0, end) + "/";
  return url;
}

export async function rejectUpstreamChallenge(response: Response) {
  if (response.headers.get("cf-mitigated") !== "challenge") return;
  await response.body?.cancel().catch(() => undefined);
  throw new GatewayError(502, "API_UPSTREAM_CHALLENGE");
}

export async function readBackendReply(
  response: Response,
): Promise<BackendReply> {
  await rejectUpstreamChallenge(response);
  if (response.status === 204) return { status: 204, value: null };
  if (response.status >= 500) {
    await response.body?.cancel().catch(() => undefined);
    throw new GatewayError(response.status, "API_UNAVAILABLE");
  }
  let value: unknown;
  try {
    value = await response.json();
  } catch (cause) {
    if (
      cause instanceof Error &&
      ["AbortError", "TimeoutError"].includes(cause.name)
    )
      throw new GatewayError(504, "API_UNAVAILABLE");
    throw new GatewayError(502, "API_RESPONSE_INVALID");
  }
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    !("success" in value) ||
    typeof value.success !== "boolean"
  )
    throw new GatewayError(502, "API_RESPONSE_INVALID");
  return {
    status: response.status,
    value: value as NonNullable<BackendReply["value"]>,
  };
}
