import { GatewayError, type BackendReply } from "../gateway/upstream";
import type { NextResponse } from "next/server";
import { clearSessionCookies } from "./session";

export function rotationMayHaveConsumedToken(error: GatewayError) {
  return error.status !== 429 && error.message !== "API_UPSTREAM_CHALLENGE";
}

export function failedTokenRotation(
  cause: unknown,
  reply: (data: unknown, status: number) => NextResponse,
) {
  const error =
    cause instanceof GatewayError
      ? cause
      : new GatewayError(500, "REQUEST_FAILED");
  const response = reply(
    { success: false, message: error.message, statusCode: error.status },
    error.status,
  );
  return rotationMayHaveConsumedToken(error)
    ? clearSessionCookies(response)
    : response;
}

/** Token pairs stay inside the gateway even if an upstream violates its contract. */
export function tokenReply(result: BackendReply): BackendReply {
  if (result.status === 200 && result.value?.success === true) return result;
  if (result.status < 400 || result.value?.success !== false)
    throw new GatewayError(502, "API_RESPONSE_INVALID");
  return {
    status: result.status,
    value: {
      success: false,
      message:
        typeof result.value.message === "string"
          ? result.value.message
          : "AUTHENTICATION_FAILED",
    },
  };
}
