import { readBoundedBody } from "./request-body";
import { randomUUID } from "node:crypto";
import {
  GatewayError as UserGatewayError,
  backendBaseUrl as apiBase,
  readBackendReply,
} from "../gateway/upstream";
export {
  GatewayError as UserGatewayError,
  backendBaseUrl as apiBase,
} from "../gateway/upstream";
export async function userBackend(
  path: string,
  token?: string,
  method = "GET",
  body?: unknown,
  key?: string,
  timeoutMs = 20000,
) {
  const url = new URL(path, apiBase());
  let response: Response;
  try {
    response = await fetch(url, {
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
  return readBackendReply(response);
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
