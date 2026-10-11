import assert from "node:assert/strict";
import test from "node:test";
import axios from "axios";
import { createAuthApi } from "../src/features/auth/api/auth-api";
import { createHttpClient } from "../src/lib/http/client";
import { AppError } from "../src/lib/http/errors";
import {
  isOtpRejected,
  isResetTokenRejected,
  isResetOutcomeUncertain,
} from "../src/features/auth/utils/otp-feedback";
import { parsePasswordResetProof } from "../src/features/auth/api/auth-contracts";

test("forgot and resend recovery use the same public JSON endpoint", async () => {
  const paths: string[] = [];
  const http = axios.create({
    adapter: async (config) => {
      paths.push(config.url ?? "");
      assert.equal(config.method, "post");
      assert.equal(config.headers.get("Content-Type"), "application/json");
      assert.equal(config.headers.has("Authorization"), false);
      assert.deepEqual(JSON.parse(config.data), { email: "user@example.com" });
      return {
        config,
        status: 202,
        statusText: "Accepted",
        headers: {},
        data: {
          success: true,
          message: "If eligible, instructions will be sent",
          data: null,
        },
      };
    },
  });
  const client = createHttpClient(
    () => "https://api.example.test/api/v1",
    http,
  );
  client.bindSession({
    generation: 1,
    getToken: async () => {
      throw new Error("Public recovery must not read tokens");
    },
    renew: async () => {
      throw new Error("Must not renew during recovery");
    },
    expire: async () => {},
  });
  const api = createAuthApi(client);
  assert.equal(await api.forgot("user@example.com"), null);
  assert.equal(await api.forgot("user@example.com"), null);
  assert.deepEqual(paths, ["/auth/password/forgot", "/auth/password/forgot"]);
});

test("recovery verifies the leading-zero OTP first, then resets with token and accepts empty 204 without login", async () => {
  let calls = 0;
  const proof = {
    resetToken: "a".repeat(43),
    expiresAt: new Date(Date.now() + 300_000).toISOString(),
  };
  const input = {
    email: "user@example.com",
    resetToken: proof.resetToken,
    newPassword: "NewPassword123!",
    confirmNewPassword: "NewPassword123!",
  };
  const http = axios.create({
    adapter: async (config) => {
      calls += 1;
      assert.equal(config.headers.has("Authorization"), false);
      assert.equal(config.headers.get("Content-Type"), "application/json");
      if (calls === 1) {
        assert.equal(config.url, "/auth/password/verify-otp");
        assert.deepEqual(JSON.parse(config.data), {
          email: input.email,
          otpCode: "000012",
        });
        return {
          config,
          status: 200,
          statusText: "OK",
          headers: {},
          data: { success: true, message: "OTP verified", data: proof },
        };
      }
      assert.equal(config.url, "/auth/password/reset");
      assert.deepEqual(JSON.parse(config.data), input);
      return {
        config,
        status: 204,
        statusText: "No Content",
        headers: {},
        data: "",
      };
    },
  });
  const api = createAuthApi(
    createHttpClient(() => "https://api.example.test/api/v1", http),
  );
  assert.deepEqual(await api.verifyRecovery(input.email, "000012"), proof);
  assert.equal(await api.reset(input), undefined);
  assert.equal(calls, 2);
});

test("malformed verification responses cannot authorize password reset", () => {
  for (const value of [
    null,
    {},
    { resetToken: "000012", expiresAt: new Date().toISOString() },
    { resetToken: "a".repeat(43), expiresAt: "bad" },
  ])
    assert.throws(
      () => parsePasswordResetProof(value),
      (error) => error instanceof AppError && error.kind === "protocol",
    );
  const rejected = new AppError("http", 400, "RESET_TOKEN_INVALID_OR_EXPIRED");
  assert.equal(isResetTokenRejected(rejected), true);
  assert.equal(isOtpRejected(rejected), false);
  assert.equal(isResetOutcomeUncertain(rejected), false);
});

test("ambiguous reset failures differ from OTP rejection and field validation", () => {
  for (const error of [
    new AppError("network"),
    new AppError("http", 500),
    new AppError("http", 503),
  ]) {
    assert.equal(isResetOutcomeUncertain(error), true);
    assert.equal(isOtpRejected(error), false);
  }
  const rejected = new AppError("http", 400, "OTP_INVALID_OR_EXPIRED");
  assert.equal(isOtpRejected(rejected), true);
  assert.equal(isResetOutcomeUncertain(rejected), false);
  for (const error of [
    new AppError("http", 400),
    new AppError("http", 429, "RATE_LIMITED"),
    new AppError("config"),
  ]) {
    assert.equal(isOtpRejected(error), false);
    assert.equal(isResetOutcomeUncertain(error), false);
  }
});

test("blocked or invalid recovery OTP is not automatically retried or resent", async () => {
  let calls = 0;
  const http = axios.create({
    adapter: async (config) => {
      calls += 1;
      assert.equal(config.url, "/auth/password/verify-otp");
      return {
        config,
        status: 400,
        statusText: "Bad Request",
        headers: {},
        data: {
          success: false,
          statusCode: 400,
          message: "OTP_INVALID_OR_EXPIRED",
        },
      };
    },
  });
  const api = createAuthApi(
    createHttpClient(() => "https://api.example.test/api/v1", http),
  );
  await assert.rejects(
    api.verifyRecovery("user@example.com", "123456"),
    isOtpRejected,
  );
  assert.equal(calls, 1);
});
