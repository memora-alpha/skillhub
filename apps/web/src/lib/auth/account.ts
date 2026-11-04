import { NextRequest, NextResponse } from "next/server";
import { sameOriginMutation } from "./origin";
import { userBackend, userJson, UserGatewayError } from "../user/backend";
const actions: Record<string, string[]> = {
  register: [
    "fullName",
    "email",
    "password",
    "confirmPassword",
    "agreeTerms",
    "timezone",
    "locale",
  ],
  "verification/resend": ["email"],
  "verification/verify": ["email", "otpCode"],
  "password/forgot": ["email"],
  "password/verify-otp": ["email", "otpCode"],
  "password/reset": [
    "email",
    "resetToken",
    "newPassword",
    "confirmNewPassword",
  ],
};
export async function accountGateway(request: NextRequest, segments: string[]) {
  const headers = {
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  };
  try {
    if (request.method !== "POST")
      throw new UserGatewayError(405, "METHOD_NOT_ALLOWED");
    if (!sameOriginMutation(request))
      throw new UserGatewayError(403, "ORIGIN_NOT_ALLOWED");
    const action = segments.join("/");
    if (!Object.hasOwn(actions, action))
      throw new UserGatewayError(404, "ROUTE_NOT_AVAILABLE");
    const source = await userJson(request);
    const body = Object.fromEntries(
      actions[action]!.filter((key) => Object.hasOwn(source, key)).map(
        (key) => [key, source[key]],
      ),
    );
    const result = await userBackend("auth/" + action, undefined, "POST", body);
    return result.status === 204
      ? new NextResponse(null, { status: 204, headers })
      : NextResponse.json(result.value, { status: result.status, headers });
  } catch (cause) {
    const error =
      cause instanceof UserGatewayError
        ? cause
        : new UserGatewayError(500, "REQUEST_FAILED");
    return NextResponse.json(
      { success: false, message: error.message },
      { status: error.status, headers },
    );
  }
}
