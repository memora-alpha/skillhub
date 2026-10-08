import { AppError } from "@/lib/http/errors";
import { isRecord } from "@/lib/http/response";

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
  expiresIn: number;
  refreshExpiresAt: string;
};
export type LoginInput = {
  email: string;
  password: string;
  rememberMe: boolean;
};
export type RegisterInput = {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  agreeTerms: true;
  timezone?: string;
  locale?: "vi" | "en";
};
export type ResetInput = {
  email: string;
  resetToken: string;
  newPassword: string;
  confirmNewPassword: string;
};
export type PasswordResetProof = {
  resetToken: string;
  expiresAt: string;
};

export function parsePasswordResetProof(value: unknown): PasswordResetProof {
  if (
    !isRecord(value) ||
    typeof value.resetToken !== "string" ||
    !/^[A-Za-z0-9_-]{43}$/.test(value.resetToken) ||
    typeof value.expiresAt !== "string" ||
    !Number.isFinite(Date.parse(value.expiresAt))
  )
    throw new AppError("protocol");
  return { resetToken: value.resetToken, expiresAt: value.expiresAt };
}

export function parseTokenPair(value: unknown): TokenPair {
  if (
    !isRecord(value) ||
    typeof value.accessToken !== "string" ||
    !value.accessToken ||
    typeof value.refreshToken !== "string" ||
    !value.refreshToken ||
    value.tokenType !== "Bearer" ||
    typeof value.expiresIn !== "number" ||
    !Number.isFinite(value.expiresIn) ||
    value.expiresIn <= 0 ||
    typeof value.refreshExpiresAt !== "string" ||
    !Number.isFinite(Date.parse(value.refreshExpiresAt))
  )
    throw new AppError("protocol");
  return value as TokenPair;
}
