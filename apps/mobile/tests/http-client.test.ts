import assert from "node:assert/strict";
import test from "node:test";
import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { createHttpClient } from "../src/lib/http/client";
import { AppError } from "../src/lib/http/errors";
import { readPayload } from "../src/lib/http/response";
import {
  creditShortfall,
  scheduleConflictMessage,
} from "../src/lib/http/scheduling-error";

test("retains validated scheduling details and ignores malformed or unrelated details", () => {
  const conflict = {
    type: "SESSION",
    overlapStartAt: "2026-11-03T14:00:00.000Z",
    overlapEndAt: "2026-11-03T15:00:00.000Z",
  };
  const readError = (message: string, details: unknown) => {
    try {
      readPayload(409, { success: false, message, details });
    } catch (error) {
      assert.ok(error instanceof AppError);
      return error;
    }
    assert.fail("Expected an HTTP error");
  };
  const error = readError("SCHEDULE_CONFLICT", {
    conflicts: [{ ...conflict, internalNote: "hidden" }],
  });
  assert.deepEqual(error.details, { conflicts: [conflict] });
  assert.match(
    scheduleConflictMessage(error) ?? "",
    /Trùng với một buổi đã đặt/,
  );
  assert.equal(
    readError("SCHEDULE_CONFLICT", {
      conflicts: [{ ...conflict, overlapEndAt: conflict.overlapStartAt }],
    }).details,
    undefined,
  );
  assert.equal(
    readError("UNRELATED", { conflicts: [conflict] }).details,
    undefined,
  );

  const viewer = "550e8400-e29b-41d4-a716-446655440000";
  const credit = readError("INSUFFICIENT_AVAILABLE_CREDIT", {
    userIds: [viewer],
  });
  assert.equal(creditShortfall(credit, viewer), "viewer");
  assert.equal(
    creditShortfall(credit, "550e8400-e29b-41d4-a716-446655440001"),
    "other",
  );
  assert.equal(
    creditShortfall(
      readError("INSUFFICIENT_AVAILABLE_CREDIT", undefined),
      viewer,
    ),
    "unknown",
  );
});

function response(
  config: InternalAxiosRequestConfig,
  status: number,
  data: unknown,
) {
  return { config, data, status, statusText: "", headers: {} };
}

test("retries one protected request after Axios receives a 401", async () => {
  let calls = 0;
  const http = axios.create({
    adapter: async (config) => {
      calls += 1;
      return calls === 1
        ? response(config, 401, { success: false, message: "INVALID_TOKEN" })
        : response(config, 200, {
            success: true,
            message: "ok",
            data: { userId: "user-1" },
          });
    },
  });
  let token = "expired";
  let renewals = 0;
  const client = createHttpClient(
    () => "https://api.example.test/api/v1",
    http,
  );
  client.bindSession({
    generation: 1,
    getToken: async () => token,
    renew: async () => {
      renewals += 1;
      token = "rotated";
    },
    expire: async () => {},
  });

  const result = await client.request("/me", { authenticated: true });
  assert.deepEqual(result, { userId: "user-1" });
  assert.equal(renewals, 1);
  assert.equal(calls, 2);
});

test("rejects a malformed Axios success envelope", async () => {
  const http = axios.create({
    adapter: async (config) =>
      response(config, 200, { id: "missing-envelope" }),
  });
  const client = createHttpClient(
    () => "https://api.example.test/api/v1",
    http,
  );
  await assert.rejects(
    client.request("/auth/login", { method: "POST", body: {} }),
    AppError,
  );
});

test("Axios-rejected HTTP responses preserve Retry-After and block duplicate reads", async () => {
  let calls = 0;
  const http = axios.create({
    adapter: async (config) => {
      calls++;
      const limited = {
        ...response(config, 429, { success: false, message: "RATE_LIMITED" }),
        headers: { "retry-after": "120" },
      };
      throw new AxiosError(
        "limited",
        "ERR_BAD_REQUEST",
        config,
        undefined,
        limited,
      );
    },
  });
  const client = createHttpClient(
    () => "https://api.example.test/api/v1",
    http,
  );
  const before = Date.now();
  await assert.rejects(
    client.request("/conversations"),
    (error) =>
      error instanceof AppError &&
      error.status === 429 &&
      error.retryAt >= before + 120000,
  );
  await assert.rejects(
    client.request("/notifications"),
    (error) => error instanceof AppError && error.status === 429,
  );
  assert.equal(calls, 1);
});
