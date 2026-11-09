import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { proxyEvents } from "./event-proxy";
import { sessionCookies } from "../auth/session";
import { authGateway } from "../auth/server";
import { tokenReply, failedTokenRotation } from "../auth/token-reply";
import {
  GatewayError,
  backendBaseUrl as baseUrl,
  readBackendReply,
  rejectUpstreamChallenge,
} from "../gateway/upstream";
import {
  sameOriginMutation,
  staffIdentity,
  upstreamPath,
  type Portal,
  safeDownload,
} from "./policy";
import {
  allowedEvidenceMime,
  allowedMaterialMime,
  evidenceMime,
  evidencePreviewKind,
} from "./evidence-file";

const headers = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};
function reply(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers });
}
function clear(response: NextResponse) {
  const cookies = sessionCookies;
  for (const name of [cookies.access, cookies.refresh])
    response.cookies.set(name, "", { ...cookies.options, maxAge: 0 });
  return response;
}
async function readLimitedBody(
  body: ReadableStream<Uint8Array>,
  maximum: number,
  code: string,
) {
  const chunks: Uint8Array[] = [];
  let size = 0;
  // pipeTo preserves byte order and backpressure and cancels the source on overflow.
  await body.pipeTo(
    new WritableStream<Uint8Array>({
      write(chunk) {
        size += chunk.byteLength;
        if (size > maximum) throw new GatewayError(413, code);
        chunks.push(chunk);
      },
    }),
  );
  return Buffer.concat(chunks);
}
async function jsonBody(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new GatewayError(415, "JSON_REQUIRED");
  if (!request.body) throw new GatewayError(400, "BODY_REQUIRED");
  const bytes = await readLimitedBody(request.body, 32768, "BODY_TOO_LARGE");
  let body: unknown;
  try {
    body = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new GatewayError(400, "INVALID_JSON");
  }
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw new GatewayError(400, "INVALID_JSON");
  return body as Record<string, unknown>;
}
async function backend(
  path: string,
  token?: string,
  method = "GET",
  body?: Record<string, unknown>,
  key?: string,
) {
  const url = new URL(path, baseUrl());
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(12000),
      headers: {
        Accept: "application/json",
        "ngrok-skip-browser-warning": "true",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(key ? { "Idempotency-Key": key } : {}),
        "X-Request-Id": randomUUID(),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch (e) {
    if (e instanceof GatewayError) throw e;
    throw new GatewayError(504, "API_UNAVAILABLE");
  }
  return readBackendReply(response);
}
async function identity(token: string, portal: Portal) {
  const result = await backend("me", token);
  if (result.status !== 200 || !result.value?.success)
    throw new GatewayError(
      result.status < 400 ? 502 : result.status,
      "SESSION_UNAVAILABLE",
    );
  const actor = staffIdentity(result.value.data);
  if (!actor) throw new GatewayError(403, "STAFF_PORTAL_ACCESS_REQUIRED");
  if (portal === "admin" && !actor.roles.includes("ADMIN"))
    throw new GatewayError(403, "ADMIN_PORTAL_ACCESS_REQUIRED");
  return actor;
}
async function fetchEvidence(
  link: unknown,
  signal: AbortSignal,
): Promise<Response> {
  if (!safeDownload(link)) throw new GatewayError(502, "INVALID_DOWNLOAD_LINK");
  try {
    return await fetch(link.url, {
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.any([signal, AbortSignal.timeout(30000)]),
    });
  } catch {
    throw new GatewayError(504, "FILE_UNAVAILABLE");
  }
}
const evidenceMaximum = 10_000_000; // Existing evidence/report upload cap.
async function validateEvidenceResponse(
  file: Response,
  maximum: number,
  material: boolean,
): Promise<string> {
  await rejectUpstreamChallenge(file);
  if (!file.ok) {
    await file.body?.cancel();
    throw new GatewayError(
      file.status === 403 || file.status === 404 ? 410 : 502,
      "FILE_UNAVAILABLE",
    );
  }
  const mime = evidenceMime(file.headers.get("content-type") ?? "");
  if (!(material ? allowedMaterialMime(mime) : allowedEvidenceMime(mime))) {
    await file.body?.cancel();
    throw new GatewayError(415, "FILE_TYPE_NOT_SUPPORTED");
  }
  if (Number(file.headers.get("content-length")) > maximum) {
    await file.body?.cancel();
    throw new GatewayError(413, "FILE_TOO_LARGE");
  }
  return mime;
}
async function evidenceContent(
  link: unknown,
  signal: AbortSignal,
  material = false,
) {
  const maximum = material ? 20_000_000 : evidenceMaximum;
  const file = await fetchEvidence(link, signal);
  const mime = await validateEvidenceResponse(file, maximum, material);
  if (!file.body) throw new GatewayError(502, "FILE_UNAVAILABLE");
  let bytes: Buffer;
  try {
    bytes = await readLimitedBody(file.body, maximum, "FILE_TOO_LARGE");
  } catch (error) {
    if (error instanceof GatewayError) throw error;
    throw new GatewayError(504, "FILE_UNAVAILABLE");
  }
  if (!bytes.length) throw new GatewayError(502, "FILE_UNAVAILABLE");
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      ...headers,
      "Content-Type": mime,
      "Content-Length": String(bytes.length),
      "Content-Disposition":
        evidencePreviewKind(mime) === "unsupported" ? "attachment" : "inline",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Referrer-Policy": "no-referrer",
    },
  });
}
async function login(request: NextRequest, portal: Portal) {
  const cookies = sessionCookies;
  const body = await jsonBody(request);
  if (
    typeof body.email !== "string" ||
    typeof body.password !== "string" ||
    body.email.trim().length < 5 ||
    body.email.trim().length > 254 ||
    body.password.length < 1 ||
    body.password.length > 64
  )
    throw new GatewayError(400, "INVALID_LOGIN_INPUT");
  // Refuse account replacement: logout first, so parallel tabs cannot silently switch identities.
  if (request.cookies.has(cookies.refresh))
    throw new GatewayError(409, "LOGOUT_BEFORE_LOGIN");
  const result = tokenReply(
    await backend("auth/login", undefined, "POST", {
      email: body.email.trim(),
      password: body.password,
      rememberMe: false,
    }),
  );
  if (result.status !== 200 || !result.value?.success)
    return reply(result.value, result.status);
  return establish(result.value.data, portal);
}
async function establish(data: unknown, portal: Portal) {
  const cookies = sessionCookies;
  const pair = data as {
    accessToken?: unknown;
    refreshToken?: unknown;
    expiresIn?: unknown;
    refreshExpiresAt?: unknown;
  };
  if (
    !pair ||
    typeof pair.accessToken !== "string" ||
    typeof pair.refreshToken !== "string" ||
    typeof pair.expiresIn !== "number" ||
    !Number.isFinite(pair.expiresIn) ||
    pair.expiresIn <= 0 ||
    typeof pair.refreshExpiresAt !== "string" ||
    !Number.isFinite(Date.parse(pair.refreshExpiresAt))
  )
    throw new GatewayError(502, "API_RESPONSE_INVALID");
  try {
    const actor = await identity(pair.accessToken, portal);
    const response = reply({ success: true, data: actor });
    response.cookies.set(cookies.access, pair.accessToken, {
      ...cookies.options,
      maxAge: Math.floor(pair.expiresIn),
    });
    response.cookies.set(cookies.refresh, pair.refreshToken, {
      ...cookies.options,
      expires: new Date(pair.refreshExpiresAt),
    });
    return response;
  } catch (e) {
    await backend("auth/logout", undefined, "POST", {
      refreshToken: pair.refreshToken,
    }).catch(() => undefined);
    throw e;
  }
}
async function refreshSession(request: NextRequest, portal: Portal) {
  const refreshToken = request.cookies.get(sessionCookies.refresh)?.value;
  if (!refreshToken) throw new GatewayError(401, "SESSION_EXPIRED");
  try {
    const result = tokenReply(
      await backend("auth/refresh", undefined, "POST", { refreshToken }),
    );
    if (result.status === 200 && result.value?.success)
      return await establish(result.value.data, portal);
    const response = reply(result.value, result.status);
    return result.status === 429 ? response : clear(response);
  } catch (cause) {
    return failedTokenRotation(cause, reply);
  }
}
async function logoutSession(request: NextRequest) {
  return authGateway(request);
}
function accessToken(request: NextRequest): string {
  const token = request.cookies.get(sessionCookies.access)?.value;
  if (!token) throw new GatewayError(401, "SESSION_EXPIRED");
  return token;
}
async function readSession(request: NextRequest, portal: Portal) {
  return reply({
    success: true,
    data: await identity(accessToken(request), portal),
  });
}
const sessionHandlers = new Map<
  string,
  (request: NextRequest, portal: Portal) => Promise<NextResponse>
>([
  ["GET", readSession],
  ["POST", login],
  ["DELETE", logoutSession],
]);
function querySuffix(request: NextRequest): string {
  if (request.method !== "GET") return "";
  const query = request.nextUrl.searchParams;
  const accepted = new URLSearchParams();
  for (const name of [
    "cursor",
    "after",
    "limit",
    "status",
    "role",
    "categoryId",
    "q",
    "unreadOnly",
    "type",
    "referenceType",
  ])
    if (query.has(name)) accepted.set(name, query.get(name)!);
  return accepted.size ? "?" + accepted : "";
}
async function forwardRequest(
  request: NextRequest,
  path: string,
  portal: Portal,
) {
  const target = upstreamPath(request.method, path, portal);
  if (!target) throw new GatewayError(404, "ROUTE_NOT_AVAILABLE");
  const token = accessToken(request);
  await identity(token, portal);
  const body = ["POST", "PATCH", "PUT", "DELETE"].includes(request.method)
    ? await jsonBody(request)
    : undefined;
  const key = request.headers.get("idempotency-key") ?? undefined;
  if (key && (key.length > 200 || /[\r\n]/.test(key)))
    throw new GatewayError(400, "INVALID_IDEMPOTENCY_KEY");
  const result = await backend(
    target + querySuffix(request),
    token,
    request.method,
    body,
    key,
  );
  if (
    path.endsWith("/content") &&
    result.status === 200 &&
    result.value?.success
  )
    return evidenceContent(
      result.value.data,
      request.signal,
      path.startsWith("materials/"),
    );
  if (result.status === 204)
    return new NextResponse(null, { status: 204, headers });
  return reply(result.value, result.status);
}
export async function staffGateway(
  request: NextRequest,
  segments: string[],
  portal: Portal = "staff",
) {
  try {
    if (request.method !== "GET" && !sameOriginMutation(request))
      throw new GatewayError(403, "ORIGIN_NOT_ALLOWED");
    const path = segments.join("/");
    if (path === "session/refresh" && request.method === "POST")
      return await refreshSession(request, portal);
    if (path === "session") {
      const handler = sessionHandlers.get(request.method);
      if (!handler) throw new GatewayError(405, "METHOD_NOT_ALLOWED");
      return await handler(request, portal);
    }
    if (path === "events" && request.method === "GET") {
      const token = accessToken(request);
      await identity(token, portal);
      return await proxyEvents(request, new URL("events", baseUrl()), token);
    }
    return await forwardRequest(request, path, portal);
  } catch (error) {
    const failure =
      error instanceof GatewayError
        ? error
        : new GatewayError(500, "REQUEST_FAILED");
    return reply(
      { success: false, message: failure.message, statusCode: failure.status },
      failure.status,
    );
  }
}
