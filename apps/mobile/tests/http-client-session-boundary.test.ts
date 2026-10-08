import assert from "node:assert/strict";
import test from "node:test";
import axios, { type InternalAxiosRequestConfig } from "axios";
import { createHttpClient } from "../src/lib/http/client";
import { AppError } from "../src/lib/http/errors";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function response(config: InternalAxiosRequestConfig, status: number) {
  return {
    config,
    status,
    statusText: "",
    headers: {},
    data:
      status === 200
        ? { success: true, message: "ok", data: { fullName: "Account A" } }
        : {
            success: false,
            message: status === 401 ? "INVALID_TOKEN" : "ACCOUNT_NOT_ACTIVE",
          },
  };
}

function fixture(
  adapter: (
    config: InternalAxiosRequestConfig,
    attempt: number,
  ) => Promise<ReturnType<typeof response>>,
  hooks: { getToken?: () => Promise<string>; renew?: () => Promise<void> } = {},
) {
  let generation = 1;
  let token = "account-a";
  const requests: string[] = [];
  let renewals = 0;
  let expirations = 0;
  const client = createHttpClient(
    () => "https://api.example.test/api/v1",
    axios.create({
      adapter: async (config) => {
        requests.push(String(config.headers.get("Authorization")));
        return adapter(config, requests.length);
      },
    }),
  );
  client.bindSession({
    get generation() {
      return generation;
    },
    getToken: async () => (hooks.getToken ? hooks.getToken() : token),
    renew: async () => {
      renewals++;
      await hooks.renew?.();
      if (generation === 1) token = "account-a-renewed";
    },
    expire: async () => {
      expirations++;
      generation++;
    },
  });
  return {
    client,
    requests,
    get renewals() {
      return renewals;
    },
    get expirations() {
      return expirations;
    },
    switchAccount: () => {
      generation++;
      token = "account-b";
    },
  };
}

const sessionError = (error: unknown) =>
  error instanceof AppError && error.kind === "session";
const patch = {
  method: "PATCH" as const,
  authenticated: true,
  body: { fullName: "Account A" },
};

for (const status of [401, 403, 200]) {
  test(`account A's delayed ${status} response cannot retry or expire account B`, async () => {
    const started = deferred();
    const reply = deferred();
    const f = fixture(async (config) => {
      started.resolve();
      await reply.promise;
      return response(config, status);
    });
    const pending = f.client.request("/me/profile", patch);
    const rejected = assert.rejects(pending, sessionError);
    await started.promise;
    f.switchAccount();
    reply.resolve();
    await rejected;
    assert.deepEqual(f.requests, ["Bearer account-a"]);
    assert.equal(f.renewals, 0);
    assert.equal(f.expirations, 0);
  });
}

test("switching account while reading the initial token prevents sending the request", async () => {
  const started = deferred();
  const reply = deferred();
  const f = fixture(async (config) => response(config, 200), {
    getToken: async () => {
      started.resolve();
      await reply.promise;
      return "account-b";
    },
  });
  const rejected = assert.rejects(
    f.client.request("/me/profile", patch),
    sessionError,
  );
  await started.promise;
  f.switchAccount();
  reply.resolve();
  await rejected;
  assert.equal(f.requests.length, 0);
});

test("switching account while renewal is pending prevents the protected retry", async () => {
  const started = deferred();
  const reply = deferred();
  const f = fixture(async (config) => response(config, 401), {
    renew: async () => {
      started.resolve();
      await reply.promise;
    },
  });
  const rejected = assert.rejects(
    f.client.request("/me/profile", patch),
    sessionError,
  );
  await started.promise;
  f.switchAccount();
  reply.resolve();
  await rejected;
  assert.deepEqual(f.requests, ["Bearer account-a"]);
  assert.equal(f.expirations, 0);
});

for (const status of [401, 403, 200]) {
  test(`account A's delayed retry ${status} response cannot expire or return data to account B`, async () => {
    const started = deferred();
    const reply = deferred();
    const f = fixture(async (config, attempt) => {
      if (attempt === 1) return response(config, 401);
      started.resolve();
      await reply.promise;
      return response(config, status);
    });
    const rejected = assert.rejects(
      f.client.request("/me/profile", patch),
      sessionError,
    );
    await started.promise;
    f.switchAccount();
    reply.resolve();
    await rejected;
    assert.deepEqual(f.requests, [
      "Bearer account-a",
      "Bearer account-a-renewed",
    ]);
    assert.equal(f.expirations, 0);
  });
}

test("an unchanged session is expired after its protected retry is still unauthorized", async () => {
  const f = fixture(async (config) => response(config, 401));
  await assert.rejects(f.client.request("/me/profile", patch), AppError);
  assert.equal(f.requests.length, 2);
  assert.equal(f.renewals, 1);
  assert.equal(f.expirations, 1);
});
