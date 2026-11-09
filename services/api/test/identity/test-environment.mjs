import { randomBytes } from "node:crypto";

export function configureIdentityTestEnvironment(namespace) {
  Object.assign(process.env, {
    NODE_ENV: "test",
    IDENTITY_JWT_KEY: randomBytes(48).toString("base64"),
    IDENTITY_OTP_KEY: randomBytes(32).toString("base64"),
    IDENTITY_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
    IDENTITY_KEY_ID: namespace,
    IDENTITY_PREVIOUS_KEYS: "",
    IDENTITY_JWT_ISSUER: namespace,
    IDENTITY_JWT_AUDIENCE: namespace,
    IDENTITY_TERMS_VERSION: "test",
    IDENTITY_DEFAULT_TIMEZONE: "UTC",
    IDENTITY_INITIAL_REPUTATION: "50",
  });
  for (const key of [
    "ACCESS_SECONDS",
    "REFRESH_SECONDS",
    "REMEMBER_SECONDS",
    "RESET_SECONDS",
    "REAUTH_SECONDS",
    "THROTTLE_WINDOW_SECONDS",
    "EMAIL_RATE_LIMIT",
    "IP_RATE_LIMIT",
    "DEVICE_RATE_LIMIT",
    "REQUEST_RATE_LIMIT",
    "DELIVERY_ATTEMPTS",
    "DELIVERY_RETENTION_SECONDS",
    "NOTIFICATION_SECONDS",
    "AVATAR_RETENTION_SECONDS",
  ])
    process.env[`IDENTITY_${key}`] = "3600";
}
