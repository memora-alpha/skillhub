import { NextRequest, NextResponse } from "next/server";
import { userBackend, userJson, UserGatewayError } from "./backend";
import { userIdentity, userUpstreamPath, userQuery } from "./policy";
import { apiBase } from "./backend";
import { proxyEvents } from "../staff/event-proxy";
import { sessionCookies } from "../auth/session";
import { sameOriginMutation } from "../auth/origin";
import { userUpload, uploadLimit } from "./upload";
import { authGateway } from "../auth/server";
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
    if (!actor)
      throw new UserGatewayError(
        me.status === 200 ? 403 : me.status,
        "USER_PORTAL_ACCESS_REQUIRED",
      );
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
async function session(request: NextRequest, refresh: boolean) {
  const token = request.cookies.get(REFRESH)?.value;
  if (request.method === "DELETE" && !refresh) {
    return authGateway(request);
  }
  if (request.method === "GET" && !refresh) {
    const access = request.cookies.get(ACCESS)?.value;
    if (!access) throw new UserGatewayError(401, "SESSION_EXPIRED");
    const result = await userBackend("me", access);
    if (result.status !== 200 || !result.value?.success)
      throw new UserGatewayError(result.status, "SESSION_EXPIRED");
    const actor = userIdentity(result.value.data);
    if (!actor) throw new UserGatewayError(403, "USER_PORTAL_ACCESS_REQUIRED");
    return reply({ success: true, data: actor });
  }
  if (request.method !== "POST")
    throw new UserGatewayError(405, "METHOD_NOT_ALLOWED");
  if (refresh) {
    if (!token) throw new UserGatewayError(401, "SESSION_EXPIRED");
    const result = await userBackend("auth/refresh", undefined, "POST", {
      refreshToken: token,
    });
    return result.status === 200 && result.value?.success
      ? establish(result.value.data)
      : clear(reply(result.value, result.status));
  }
  if (token) throw new UserGatewayError(409, "LOGOUT_BEFORE_LOGIN");
  const body = await userJson(request);
  if (
    typeof body.email !== "string" ||
    body.email.length > 320 ||
    typeof body.password !== "string" ||
    body.password.length > 1024
  )
    throw new UserGatewayError(400, "INVALID_LOGIN_INPUT");
  const result = await userBackend("auth/login", undefined, "POST", {
    email: body.email.trim(),
    password: body.password,
    rememberMe: false,
  });
  return result.status === 200 && result.value?.success
    ? establish(result.value.data)
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
      const token = request.cookies.get(ACCESS)?.value;
      if (!token) throw new UserGatewayError(401, "SESSION_EXPIRED");
      return proxyEvents(request, new URL("events", apiBase()), token);
    }
    const target = userUpstreamPath(request.method, segments);
    if (!target) throw new UserGatewayError(404, "ROUTE_NOT_AVAILABLE");
    const token = request.cookies.get(ACCESS)?.value;
    if (!token) throw new UserGatewayError(401, "SESSION_EXPIRED");
    const cap = request.method === "POST" ? uploadLimit(target) : null;
    if (cap) {
      const result = await userUpload(request, target, token, cap);
      return reply(result.value, result.status);
    }
    const key = request.headers.get("idempotency-key") ?? undefined;
    if (key && (key.length > 200 || /[\r\n]/.test(key)))
      throw new UserGatewayError(400, "INVALID_IDEMPOTENCY_KEY");
    const bodyless =
      (request.method === "PATCH" &&
        /^notifications\/[0-9a-f-]+\/read$/i.test(target)) ||
      (request.method === "POST" &&
        /^(payments\/[0-9a-f-]+\/cancel|me\/materials\/[0-9a-f-]+\/(submit|archive))$/i.test(
          target,
        ));
    const body =
      !bodyless && ["POST", "PATCH"].includes(request.method)
        ? await userJson(request)
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
