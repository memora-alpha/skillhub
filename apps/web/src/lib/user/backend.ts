import { readBoundedBody } from "./request-body";
import { randomUUID } from "node:crypto";
export class UserGatewayError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function apiBase() {
  const value =
    process.env.NEXT_PUBLIC_API_URL ??
    process.env.SKILLHUB_API_URL ??
    process.env.EXPO_PUBLIC_API_URL ??
    "http://localhost:3001/api/v1";
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new UserGatewayError(503, "API_CONFIGURATION_INVALID");
  }
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new UserGatewayError(503, "API_CONFIGURATION_INVALID");
  url.pathname = url.pathname.replace(/\/$/, "") + "/";
  return url;
}
export async function userBackend(
  path: string,
  token?: string,
  method = "GET",
  body?: unknown,
  key?: string,
  timeoutMs = 20000,
) {
  let response: Response;
  try {
    response = await fetch(new URL(path, apiBase()), {
      method,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        Accept: "application/json",
        "X-Request-Id": randomUUID(),
        ...(token ? { Authorization: "Bearer " + token } : {}),
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(key ? { "Idempotency-Key": key } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new UserGatewayError(504, "API_UNAVAILABLE");
  }
  if (response.status === 204) return { status: 204, value: null };
  if (response.status >= 500) {
    await response.body?.cancel().catch(() => undefined);
    throw new UserGatewayError(response.status, "API_UNAVAILABLE");
  }
  let value: unknown;
  try {
    value = await response.json();
  } catch {
    throw new UserGatewayError(502, "API_RESPONSE_INVALID");
  }
  if (!value || typeof value !== "object" || !("success" in value))
    throw new UserGatewayError(502, "API_RESPONSE_INVALID");
  return {
    status: response.status,
    value: value as { success: boolean; data?: unknown; message?: string },
  };
}
export async function userJson(request: Request) {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new UserGatewayError(415, "JSON_REQUIRED");
  if (!request.body) throw new UserGatewayError(400, "BODY_REQUIRED");
  const bodyBytes = await readBoundedBody(
    request.body,
    262144,
    () => new UserGatewayError(413, "BODY_TOO_LARGE"),
  );
  let value: unknown;
  try {
    value = JSON.parse(bodyBytes.toString("utf8"));
  } catch {
    throw new UserGatewayError(400, "INVALID_JSON");
  }
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new UserGatewayError(400, "INVALID_JSON");
  return value as Record<string, unknown>;
}
