import assert from "node:assert/strict";
import test from "node:test";
import axios, { type InternalAxiosRequestConfig } from "axios";
import { createHttpClient } from "../src/lib/http/client";
import { AppError } from "../src/lib/http/errors";

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
