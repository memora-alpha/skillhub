import { NextRequest, NextResponse } from "next/server";
import { userBackend, userJson, UserGatewayError } from "../user/backend";
import { userIdentity } from "../user/policy";
import { staffIdentity } from "../staff/policy";
import { sameOriginMutation } from "./origin";
import {
  clearSessionCookies,
  sessionCookies,
  sessionDestination,
} from "./session";

const headers = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};
const reply = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers });

async function identity(token: string) {
  const result = await userBackend("me", token);
  if (result.status !== 200 || !result.value?.success)
    throw new UserGatewayError(
      result.status === 200 ? 502 : result.status,
      "SESSION_EXPIRED",
    );
  const destination = sessionDestination(result.value.data);
  if (
    !destination ||
    !(destination.role === "USER"
      ? userIdentity(result.value.data)
      : staffIdentity(result.value.data))
  )
    throw new UserGatewayError(403, "ACCOUNT_ACCESS_DENIED");
  return destination;
}

async function establish(value: unknown) {
  const pair = value as {
    accessToken?: string;
    refreshToken?: string;
    expiresIn?: number;
    refreshExpiresAt?: string;
  } | null;
  if (
    !pair ||
    typeof pair.accessToken !== "string" ||
    !pair.accessToken ||
    typeof pair.refreshToken !== "string" ||
    !pair.refreshToken ||
    typeof pair.expiresIn !== "number" ||
    !Number.isFinite(pair.expiresIn) ||
    pair.expiresIn < 1 ||
    typeof pair.refreshExpiresAt !== "string" ||
    !Number.isFinite(Date.parse(pair.refreshExpiresAt)) ||
    Date.parse(pair.refreshExpiresAt) <= Date.now()
  )
    throw new UserGatewayError(502, "API_RESPONSE_INVALID");
  try {
    const destination = await identity(pair.accessToken);
    const response = reply({ success: true, data: destination });
    response.cookies.set(sessionCookies.access, pair.accessToken, {
      ...sessionCookies.options,
      maxAge: Math.floor(pair.expiresIn),
    });
    response.cookies.set(sessionCookies.refresh, pair.refreshToken, {
      ...sessionCookies.options,
      expires: new Date(pair.refreshExpiresAt),
    });
    // Remove cookies issued by the former portal-specific login pages.
    for (const portal of ["user", "staff", "admin"])
      for (const kind of ["access", "refresh"])
        response.cookies.set(`skillhub_${portal}_${kind}`, "", {
          ...sessionCookies.options,
          path: `/api/${portal}`,
          maxAge: 0,
        });
    return response;
  } catch (error) {
    await userBackend("auth/logout", undefined, "POST", {
      refreshToken: pair.refreshToken,
    }).catch(() => undefined);
    throw error;
  }
}

export async function authGateway(request: NextRequest, refresh = false) {
  let rotationStarted = false;
  try {
    if (request.method !== "GET" && !sameOriginMutation(request))
      throw new UserGatewayError(403, "ORIGIN_NOT_ALLOWED");
    const refreshToken = request.cookies.get(sessionCookies.refresh)?.value;
    if (refresh) {
      if (request.method !== "POST")
        throw new UserGatewayError(405, "METHOD_NOT_ALLOWED");
      if (!refreshToken) throw new UserGatewayError(401, "SESSION_EXPIRED");
      rotationStarted = true;
      const result = await userBackend("auth/refresh", undefined, "POST", {
        refreshToken,
      });
      if (result.status === 200 && result.value?.success)
        return await establish(result.value.data);
      const response = reply(result.value, result.status);
      return result.status === 429 ? response : clearSessionCookies(response);
    }
    if (request.method === "GET") {
      const access = request.cookies.get(sessionCookies.access)?.value;
      const guest = () =>
        reply({
          success: true,
          data: null,
          meta: { refreshRequired: Boolean(refreshToken) },
        });
      if (!access) return guest();
      try {
        return reply({ success: true, data: await identity(access) });
      } catch (cause) {
        if (!(cause instanceof UserGatewayError) || cause.status !== 401)
          throw cause;
        const response = guest();
        return refreshToken ? response : clearSessionCookies(response);
      }
    }
    if (request.method === "DELETE") {
      let serverRevoked = !refreshToken;
      if (refreshToken) {
        try {
          const result = await userBackend(
            "auth/logout",
            undefined,
            "POST",
            { refreshToken },
            undefined,
            5000,
          );
          serverRevoked = result.status === 204;
        } catch {
          // Local sign-out must remain possible while the API is unavailable.
          // This does not claim that server-side revocation was completed.
        }
      }
      return clearSessionCookies(
        reply({ success: true, data: null, meta: { serverRevoked } }),
      );
    }
    if (request.method !== "POST")
      throw new UserGatewayError(405, "METHOD_NOT_ALLOWED");
    if (refreshToken) throw new UserGatewayError(409, "LOGOUT_BEFORE_LOGIN");
    const body = await userJson(request);
    if (
      typeof body.email !== "string" ||
      !body.email.trim() ||
      body.email.length > 320 ||
      typeof body.password !== "string" ||
      !body.password ||
      body.password.length > 1024
    )
      throw new UserGatewayError(400, "INVALID_LOGIN_INPUT");
    const result = await userBackend("auth/login", undefined, "POST", {
      email: body.email.trim(),
      password: body.password,
      rememberMe: false,
    });
    return result.status === 200 && result.value?.success
      ? await establish(result.value.data)
      : reply(result.value, result.status);
  } catch (cause) {
    const error =
      cause instanceof UserGatewayError
        ? cause
        : new UserGatewayError(500, "REQUEST_FAILED");
    const response = reply(
      { success: false, message: error.message, statusCode: error.status },
      error.status,
    );
    // A refresh may have rotated upstream before its response was lost. Never
    // keep replaying that credential or leave it blocking a fresh sign-in.
    return rotationStarted && error.status !== 429
      ? clearSessionCookies(response)
      : response;
  }
}
