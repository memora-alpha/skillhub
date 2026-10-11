import type { HttpClient } from "@/lib/http/client";
import {
  parseTokenPair,
  parsePasswordResetProof,
  type LoginInput,
  type RegisterInput,
  type ResetInput,
} from "./auth-contracts";

export function createAuthApi(client: HttpClient) {
  const post = (path: string, body: unknown) =>
    client.request(`/auth/${path}`, { method: "POST", body });
  return {
    login: async (input: LoginInput) =>
      parseTokenPair(await post("login", input)),
    refresh: async (refreshToken: string) =>
      parseTokenPair(await post("refresh", { refreshToken })),
    register: (input: RegisterInput) => post("register", input),
    verify: (email: string, otpCode: string) =>
      post("verification/verify", { email, otpCode }),
    resend: (email: string) => post("verification/resend", { email }),
    forgot: (email: string) => post("password/forgot", { email }),
    verifyRecovery: async (email: string, otpCode: string) =>
      parsePasswordResetProof(
        await post("password/verify-otp", { email, otpCode }),
      ),
    reset: (input: ResetInput) => post("password/reset", input),
    logout: (refreshToken: string) => post("logout", { refreshToken }),
    logoutAll: () =>
      client.request("/auth/logout-all", {
        method: "POST",
        body: {},
        authenticated: true,
      }),
  };
}
export type AuthApi = ReturnType<typeof createAuthApi>;
