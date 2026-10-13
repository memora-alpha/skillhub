import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import {
  sameOriginMutation,
  staffIdentity,
  upstreamPath,
  type Portal,
  safeDownload,
} from "./policy";
import {
  allowedEvidenceMime,
  evidenceMime,
  evidencePreviewKind,
} from "./evidence-file";

const ACCESS = "skillhub_staff_access";
const REFRESH = "skillhub_staff_refresh";
const cookieOptions = {
  httpOnly: true,
  sameSite: "strict" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/api/staff",
};
const headers = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};
class GatewayError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
function reply(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers });
}
function cookiesFor(portal: Portal) {
  return {
    access: portal === "staff" ? ACCESS : "skillhub_admin_access",
    refresh: portal === "staff" ? REFRESH : "skillhub_admin_refresh",
    options: { ...cookieOptions, path: `/api/${portal}` },
  };
}
function clear(response: NextResponse, portal: Portal) {
  const cookies = cookiesFor(portal);
  for (const name of [cookies.access, cookies.refresh])
    response.cookies.set(name, "", { ...cookies.options, maxAge: 0 });
  return response;
}
function baseUrl() {
  const u = new URL(
    process.env.SKILLHUB_API_URL ??
      process.env.EXPO_PUBLIC_API_URL ??
      "http://localhost:3001/api/v1",
  );
  if (
    !["http:", "https:"].includes(u.protocol) ||
    u.username ||
    u.password ||
    u.search ||
    u.hash
  )
    throw new GatewayError(503, "API_CONFIGURATION_INVALID");
  u.pathname = u.pathname.replace(/\/+$/, "") + "/";
  return u;
}
async function jsonBody(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new GatewayError(415, "JSON_REQUIRED");
  const reader = request.body?.getReader();
  if (!reader) throw new GatewayError(400, "BODY_REQUIRED");
  let size = 0,
    text = "";
  const decoder = new TextDecoder();
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    size += part.value.byteLength;
    if (size > 32768) {
      await reader.cancel();
      throw new GatewayError(413, "BODY_TOO_LARGE");
    }
    text += decoder.decode(part.value, { stream: true });
  }
  let body: unknown;
  try {
    body = JSON.parse(text + decoder.decode());
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
  let response: Response;
  try {
    response = await fetch(new URL(path, baseUrl()), {
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
  if (response.status === 204) return { status: 204, value: null };
  let value: unknown;
  try {
    value = await response.json();
  } catch {
    throw new GatewayError(502, "API_RESPONSE_INVALID");
  }
  if (!value || typeof value !== "object" || !("success" in value))
    throw new GatewayError(502, "API_RESPONSE_INVALID");
  return {
    status: response.status,
    value: value as { success: boolean; data?: unknown; message?: unknown },
  };
}
async function identity(token: string, portal: Portal) {
  const result = await backend("me", token);
  if (result.status !== 200 || !result.value?.success)
    throw new GatewayError(
      result.status === 200 ? 502 : result.status,
      "SESSION_UNAVAILABLE",
    );
  const actor = staffIdentity(result.value.data);
  if (!actor) throw new GatewayError(403, "STAFF_PORTAL_ACCESS_REQUIRED");
  if (portal === "admin" && !actor.roles.includes("ADMIN"))
    throw new GatewayError(403, "ADMIN_PORTAL_ACCESS_REQUIRED");
  return actor;
}
async function evidenceContent(link: unknown, signal: AbortSignal) {
  if (!safeDownload(link)) throw new GatewayError(502, "INVALID_DOWNLOAD_LINK");
  const maximum = 10_000_000; // Existing evidence/report upload cap.
  let file: Response;
  try {
    file = await fetch(link.url, {
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.any([signal, AbortSignal.timeout(30000)]),
    });
  } catch {
    throw new GatewayError(504, "FILE_UNAVAILABLE");
  }
  if (!file.ok) {
    await file.body?.cancel();
    throw new GatewayError(
      file.status === 403 || file.status === 404 ? 410 : 502,
      "FILE_UNAVAILABLE",
    );
  }
  const mime = evidenceMime(file.headers.get("content-type") ?? "");
  if (!allowedEvidenceMime(mime)) {
    await file.body?.cancel();
    throw new GatewayError(415, "FILE_TYPE_NOT_SUPPORTED");
  }
  if (Number(file.headers.get("content-length")) > maximum) {
    await file.body?.cancel();
    throw new GatewayError(413, "FILE_TOO_LARGE");
  }
  const reader = file.body?.getReader();
  if (!reader) throw new GatewayError(502, "FILE_UNAVAILABLE");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > maximum) {
        await reader.cancel();
        throw new GatewayError(413, "FILE_TOO_LARGE");
      }
      chunks.push(part.value);
    }
  } catch (error) {
    if (error instanceof GatewayError) throw error;
    throw new GatewayError(504, "FILE_UNAVAILABLE");
  }
  if (!size) throw new GatewayError(502, "FILE_UNAVAILABLE");
  return new NextResponse(Buffer.concat(chunks), {
    headers: {
      ...headers,
      "Content-Type": mime,
      "Content-Length": String(size),
      "Content-Disposition":
        evidencePreviewKind(mime) === "unsupported" ? "attachment" : "inline",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Referrer-Policy": "no-referrer",
    },
  });
}
async function login(request: NextRequest, portal: Portal) {
  const cookies = cookiesFor(portal);
  const body = await jsonBody(request);
  if (
    typeof body.email !== "string" ||
    typeof body.password !== "string" ||
    body.email.length > 320 ||
    body.password.length > 1024
  )
    throw new GatewayError(400, "INVALID_LOGIN_INPUT");
  // Refuse account replacement: logout first, so parallel tabs cannot silently switch identities.
  if (request.cookies.has(cookies.refresh))
    throw new GatewayError(409, "LOGOUT_BEFORE_LOGIN");
  const result = await backend("auth/login", undefined, "POST", {
    email: body.email.trim(),
    password: body.password,
    rememberMe: false,
  });
  if (result.status !== 200 || !result.value?.success)
    return reply(result.value, result.status);
  return establish(result.value.data, portal);
}
async function establish(data: unknown, portal: Portal) {
  const cookies = cookiesFor(portal);
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
export async function staffGateway(
  request: NextRequest,
  segments: string[],
  portal: Portal = "staff",
) {
  const cookies = cookiesFor(portal);
  try {
    const path = segments.join("/");
    if (request.method !== "GET" && !sameOriginMutation(request))
      throw new GatewayError(403, "ORIGIN_NOT_ALLOWED");
    if (path === "session/refresh" && request.method === "POST") {
      const refreshToken = request.cookies.get(cookies.refresh)?.value;
      if (!refreshToken) throw new GatewayError(401, "SESSION_EXPIRED");
      const result = await backend("auth/refresh", undefined, "POST", {
        refreshToken,
      });
      if (result.status !== 200 || !result.value?.success) {
        const response = reply(result.value, result.status);
        return result.status === 401 ? clear(response, portal) : response;
      }
      return await establish(result.value.data, portal);
    }
    if (path === "session") {
      if (request.method === "POST") return await login(request, portal);
      if (request.method === "DELETE") {
        const token = request.cookies.get(cookies.refresh)?.value;
        if (token) {
          const result = await backend("auth/logout", undefined, "POST", {
            refreshToken: token,
          });
          if (result.status !== 204 && result.status !== 401)
            return reply(result.value, result.status);
        }
        return clear(reply({ success: true, data: null }), portal);
      }
      if (request.method === "GET") {
        const token = request.cookies.get(cookies.access)?.value;
        if (!token) throw new GatewayError(401, "SESSION_EXPIRED");
        return reply({ success: true, data: await identity(token, portal) });
      }
      throw new GatewayError(405, "METHOD_NOT_ALLOWED");
    }
    const target = upstreamPath(request.method, path, portal);
    if (!target) throw new GatewayError(404, "ROUTE_NOT_AVAILABLE");
    const token = request.cookies.get(cookies.access)?.value;
    if (!token) throw new GatewayError(401, "SESSION_EXPIRED");
    await identity(token, portal);
    const query = new URL(request.url).searchParams;
    const accepted = new URLSearchParams();
    for (const name of [
      "cursor",
      "limit",
      "status",
      "role",
      "categoryId",
      "q",
      "unreadOnly",
    ])
      if (query.has(name)) accepted.set(name, query.get(name)!);
    const suffix =
      request.method === "GET" && accepted.size ? `?${accepted}` : "";
    const body = ["POST", "PATCH", "PUT", "DELETE"].includes(request.method)
      ? await jsonBody(request)
      : undefined;
    const key = request.headers.get("idempotency-key") ?? undefined;
    if (key && (key.length > 200 || /[\r\n]/.test(key)))
      throw new GatewayError(400, "INVALID_IDEMPOTENCY_KEY");
    const result = await backend(
      target + suffix,
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
      return await evidenceContent(result.value.data, request.signal);
    return result.status === 204
      ? new NextResponse(null, { status: 204, headers })
      : reply(result.value, result.status);
  } catch (e) {
    const error =
      e instanceof GatewayError ? e : new GatewayError(500, "REQUEST_FAILED");
    return reply(
      { success: false, message: error.message, statusCode: error.status },
      error.status,
    );
  }
}
