import { test } from "node:test";
import assert from "node:assert/strict";
import { IdentityCrypto } from "../../dist/modules/auth/domain/identity-crypto.js";
import { IdentityConfig } from "../../dist/configs/identity.config.js";
import { ConfigService } from "@nestjs/config";
import { ValidationPipe } from "@nestjs/common";
import {
  RegisterDto,
  ResetDto,
} from "../../dist/modules/auth/presentation/http/auth.dto.js";
import {
  normalizeEmail,
  validPassword,
  validFullName,
  validTimezone,
} from "../../dist/modules/users/domain/profile-policy.js";

test("identity validation preserves password and Unicode names", () => {
  assert.equal(normalizeEmail("  TEST@Example.com "), "test@example.com");
  assert.ok(validFullName("Nguyễn Thị Hà"));
  assert.ok(!validFullName("1234"));
  assert.ok(!validFullName("<script>"));
  assert.ok(validPassword("Strong123!"));
  assert.ok(!validPassword("weak1234"));
  assert.ok(!validPassword("A1!" + "x".repeat(62)));
  assert.ok(validTimezone("Asia/Ho_Chi_Minh"));
  assert.ok(!validTimezone("Mars/Test"));
});

test("strict config rejects missing, malformed and reused secrets without revealing them", () => {
  const values = {
    NODE_ENV: "test",
    IDENTITY_JWT_KEY: "test-jwt-key-with-at-least-thirty-two-bytes",
    IDENTITY_OTP_KEY: Buffer.alloc(32, 1).toString("base64"),
    IDENTITY_ENCRYPTION_KEY: Buffer.alloc(32, 2).toString("base64"),
    IDENTITY_KEY_ID: "test",
    IDENTITY_JWT_ISSUER: "test",
    IDENTITY_JWT_AUDIENCE: "test",
    IDENTITY_TERMS_VERSION: "test",
    IDENTITY_DEFAULT_TIMEZONE: "UTC",
  };
  for (const name of [
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
    values[`IDENTITY_${name}`] = "60";
  assert.equal(
    new IdentityConfig(new ConfigService(values)).initialReputation,
    null,
  );
  for (const patch of [
    { IDENTITY_JWT_KEY: "" },
    { IDENTITY_OTP_KEY: "secret-invalid-value" },
    { IDENTITY_ENCRYPTION_KEY: values.IDENTITY_OTP_KEY },
    { IDENTITY_ACCESS_SECONDS: "0" },
    { IDENTITY_DEFAULT_TIMEZONE: "invalid" },
    { NODE_ENV: "production" },
    { IDENTITY_INITIAL_REPUTATION: "101" },
  ]) {
    assert.throws(
      () => new IdentityConfig(new ConfigService({ ...values, ...patch })),
      (error) =>
        !error.message.includes("secret-invalid-value") &&
        !error.message.includes(values.IDENTITY_JWT_KEY),
    );
  }
});

test("HTTP DTO validation rejects privilege injection, wrong confirmation and weak reset", async () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });
  const valid = {
    email: " USER@Example.com ",
    fullName: " Nguyễn Hà ",
    password: "Strong123!",
    confirmPassword: "Strong123!",
    agreeTerms: true,
  };
  const result = await pipe.transform(valid, {
    type: "body",
    metatype: RegisterDto,
  });
  assert.equal(result.email, "user@example.com");
  assert.equal(result.fullName, "Nguyễn Hà");
  for (const patch of [
    { roles: ["ADMIN"] },
    { agreeTerms: false },
    { confirmPassword: "Mismatch123!" },
    { timezone: "Mars/Test" },
    { locale: "fr" },
  ])
    await assert.rejects(
      pipe.transform(
        { ...valid, ...patch },
        { type: "body", metatype: RegisterDto },
      ),
    );
  await assert.rejects(
    pipe.transform(
      {
        email: "user@example.com",
        otpCode: "000012",
        newPassword: "weak",
        confirmNewPassword: "weak",
      },
      { type: "body", metatype: ResetDto },
    ),
  );
});

test("OTP binds challenge/purpose; ciphertext authenticates and opaque secrets hash", async () => {
  const crypto = new IdentityCrypto({
    otpKey: Buffer.alloc(32, 1),
    encryptionKey: Buffer.alloc(32, 2),
  });
  const digest = crypto.otpDigest("id", "REGISTER", "000012");
  assert.ok(
    crypto.matches(digest, crypto.otpDigest("id", "REGISTER", "000012")),
  );
  assert.ok(
    !crypto.matches(digest, crypto.otpDigest("id", "RESET_PASSWORD", "000012")),
  );
  const cipher = crypto.encrypt("000012", "delivery");
  assert.equal(crypto.decrypt(cipher, "delivery"), "000012");
  assert.throws(() => crypto.decrypt(cipher, "another-delivery"));
  cipher[cipher.length - 1] ^= 1;
  assert.throws(() => crypto.decrypt(cipher, "delivery"));
  const password = await crypto.hashPassword("Strong123!");
  assert.match(password, /^\$argon2id\$/);
  assert.ok(await crypto.verifyPassword(password, "Strong123!"));
  assert.ok(!(await crypto.verifyPassword(password, "Wrong123!")));
  assert.equal(crypto.secretDigest(crypto.secret()).length, 32);
});
