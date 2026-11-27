import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { apiBase, userBackend, userJson, UserGatewayError } from "./backend";
import { readBackendReply, rejectUpstreamChallenge } from "../gateway/upstream";
import {
  userIdentity,
  userUpstreamPath,
  userQuery,
  isBodyless,
} from "./policy";
import { proxyEvents } from "../staff/event-proxy";
import { sessionCookies } from "../auth/session";
import { sameOriginMutation } from "../auth/origin";
import { userUpload, uploadLimit } from "./upload";
import { authGateway } from "../auth/server";
import { tokenReply, failedTokenRotation } from "../auth/token-reply";
const ACCESS = sessionCookies.access,
  REFRESH = sessionCookies.refresh;
const cookies = sessionCookies.options;
const headers = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};
const reply = (value: unknown, status = 200) =>
  NextResponse.json(value, { status, headers });
function clear(response: NextResponse) {
  for (const name of [ACCESS, REFRESH])
    response.cookies.set(name, "", { ...cookies, maxAge: 0 });
  return response;
}
async function establish(value: unknown) {
  const pair = value as {
    accessToken?: string;
    refreshToken?: string;
    expiresIn?: number;
    refreshExpiresAt?: string;
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
    throw new UserGatewayError(502, "API_RESPONSE_INVALID");
  try {
    const me = await userBackend("me", pair.accessToken);
    const actor = me.value?.success && userIdentity(me.value.data);
    if (!actor) {
      let status = me.status;
      if (status === 200) status = 403;
      else if (status < 400) status = 502;
      throw new UserGatewayError(status, "USER_PORTAL_ACCESS_REQUIRED");
    }
    const response = reply({ success: true, data: actor });
    response.cookies.set(ACCESS, pair.accessToken, {
      ...cookies,
      maxAge: Math.floor(pair.expiresIn),
    });
    response.cookies.set(REFRESH, pair.refreshToken, {
      ...cookies,
      expires: new Date(pair.refreshExpiresAt),
    });
    return response;
  } catch (error) {
    await userBackend("auth/logout", undefined, "POST", {
      refreshToken: pair.refreshToken,
    }).catch(() => undefined);
    throw error;
  }
}
function accessToken(request: NextRequest) {
  const token = request.cookies.get(ACCESS)?.value;
  if (!token) throw new UserGatewayError(401, "SESSION_EXPIRED");
  return token;
}
async function readSession(request: NextRequest) {
  const result = await userBackend("me", accessToken(request));
  if (result.status !== 200 || !result.value?.success)
    throw new UserGatewayError(
      result.status < 400 ? 502 : result.status,
      "SESSION_EXPIRED",
    );
  const actor = userIdentity(result.value.data);
  if (!actor) throw new UserGatewayError(403, "USER_PORTAL_ACCESS_REQUIRED");
  return reply({ success: true, data: actor });
}
async function refreshSession(token: string | undefined) {
  if (!token) throw new UserGatewayError(401, "SESSION_EXPIRED");
  try {
    const result = tokenReply(
      await userBackend("auth/refresh", undefined, "POST", {
        refreshToken: token,
      }),
    );
    if (result.status === 200 && result.value?.success)
      return await establish(result.value.data);
    const response = reply(result.value, result.status);
    return result.status === 429 ? response : clear(response);
  } catch (cause) {
    return failedTokenRotation(cause, reply);
  }
}
async function loginSession(request: NextRequest, token: string | undefined) {
  if (token) throw new UserGatewayError(409, "LOGOUT_BEFORE_LOGIN");
  const body = await userJson(request);
  if (
    typeof body.email !== "string" ||
    body.email.trim().length < 5 ||
    body.email.trim().length > 254 ||
    typeof body.password !== "string" ||
    body.password.length < 1 ||
    body.password.length > 64 ||
    (body.rememberMe !== undefined && typeof body.rememberMe !== "boolean")
  )
    throw new UserGatewayError(400, "INVALID_LOGIN_INPUT");
  const result = tokenReply(
    await userBackend("auth/login", undefined, "POST", {
      email: body.email.trim(),
      password: body.password,
      rememberMe: body.rememberMe === true,
    }),
  );
  return result.status === 200 && result.value?.success
    ? establish(result.value.data)
    : reply(result.value, result.status);
}
async function session(request: NextRequest, refresh: boolean) {
  if (!refresh) {
    if (request.method === "DELETE") return authGateway(request);
    if (request.method === "GET") return readSession(request);
  }
  if (request.method !== "POST")
    throw new UserGatewayError(405, "METHOD_NOT_ALLOWED");
  const token = request.cookies.get(REFRESH)?.value;
  return refresh ? refreshSession(token) : loginSession(request, token);
}
const chatAttachmentBinary =
  /^conversations\/[0-9a-f-]{36}\/messages\/[0-9a-f-]{36}\/attachments\/[0-9a-f-]{36}\/(content|preview|thumbnail)$/i;
const whiteboardRoute = /^sessions\/[0-9a-f-]{36}\/whiteboard$/i;
const whiteboardBodyCap = 2 * 1024 * 1024 + 4096;

async function proxyChatAttachmentBinary(
  request: NextRequest,
  target: string,
  token: string,
) {
  const url = new URL(target, apiBase());
  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(30000)]),
      headers: {
        Authorization: "Bearer " + token,
        "X-Request-Id": randomUUID(),
      },
    });
  } catch {
    throw new UserGatewayError(504, "API_UNAVAILABLE");
  }
  await rejectUpstreamChallenge(response);
  if (response.status !== 200) {
    const failed = await readBackendReply(response);
    return reply(failed.value, failed.status);
  }
  if (!response.body) throw new UserGatewayError(502, "API_RESPONSE_INVALID");
  const contentType =
    response.headers.get("content-type")?.split(";")[0]?.trim() ||
    "application/octet-stream";
  const contentLength = response.headers.get("content-length");
  const contentDisposition = response.headers.get("content-disposition");
  return new NextResponse(response.body, {
    status: 200,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Referrer-Policy": "no-referrer",
      "Content-Type": contentType,
      ...(contentLength ? { "Content-Length": contentLength } : {}),
      ...(contentDisposition
        ? { "Content-Disposition": contentDisposition }
        : {}),
    },
  });
}

async function forwardRequest(request: NextRequest, segments: string[]) {
  const target = userUpstreamPath(request.method, segments);
  if (!target) throw new UserGatewayError(404, "ROUTE_NOT_AVAILABLE");
  const token = accessToken(request);
  if (request.method === "GET" && chatAttachmentBinary.test(target)) {
    return proxyChatAttachmentBinary(request, target, token);
  }
  const key = request.headers.get("idempotency-key") ?? undefined;
  if (key && (key.length > 200 || /[\r\n]/.test(key)))
    throw new UserGatewayError(400, "INVALID_IDEMPOTENCY_KEY");
  const cap = request.method === "POST" ? uploadLimit(target) : null;
  if (cap) {
    const result = await userUpload(request, target, token, cap, key);
    return reply(result.value, result.status);
  }
  const maxBodyBytes =
    request.method === "PUT" && whiteboardRoute.test(target)
      ? whiteboardBodyCap
      : 262144;
  const body =
    !isBodyless(request.method, target) &&
    ["POST", "PUT", "PATCH"].includes(request.method)
      ? await userJson(request, maxBodyBytes)
      : undefined;
  const result = await userBackend(
    target + userQuery(request.nextUrl.searchParams),
    token,
    request.method,
    body,
    key,
  );
  return result.status === 204
    ? new NextResponse(null, { status: 204, headers })
    : reply(result.value, result.status);
}
export async function userGateway(request: NextRequest, segments: string[]) {
  try {
    if (request.method !== "GET" && !sameOriginMutation(request))
      throw new UserGatewayError(403, "ORIGIN_NOT_ALLOWED");
    const path = segments.join("/");
    if (path === "session" || path === "session/refresh")
      return await session(request, path.endsWith("/refresh"));
    if (path === "events" && request.method === "GET") {
      return proxyEvents(
        request,
        new URL("events", apiBase()),
        accessToken(request),
      );
    }
    return await forwardRequest(request, segments);
  } catch (cause) {
    const error =
      cause instanceof UserGatewayError
        ? cause
        : new UserGatewayError(500, "REQUEST_FAILED");
    return reply(
      { success: false, message: error.message, statusCode: error.status },
      error.status,
    );
  }
}
