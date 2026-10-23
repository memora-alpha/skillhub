import assert from "node:assert/strict";
import test from "node:test";
import axios from "axios";
import { AppError } from "../src/lib/http/errors";
import { RequestCoordinator, retryAfterAt } from "../src/lib/http/rate-limit";
import { createHttpClient } from "../src/lib/http/client";

test("Retry-After accepts seconds/dates, rejects invalid or unreasonable values", () => {
  const now = Date.parse("2026-10-23T10:00:00Z");
  assert.equal(retryAfterAt("90", now), now + 90000);
  assert.equal(
    retryAfterAt("Fri, 23 Oct 2026 10:02:00 GMT", now),
    now + 120000,
  );
  for (const value of [
    undefined,
    "bad",
    "-1",
    "999999999999",
    "Fri, 23 Oct 2026 09:00:00 GMT",
  ])
    assert.equal(retryAfterAt(value, now), 0);
});

test("read concurrency is bounded and an aborted queued read never reaches transport", async () => {
  const requests = new RequestCoordinator(Date.now, 2);
  const releases: (() => void)[] = [];
  let calls = 0;
  const read = () =>
    requests.run("/read", "GET", undefined, async () => {
      calls++;
      await new Promise<void>((resolve) => releases.push(resolve));
      return calls;
    });
  const first = read();
  const second = read();
  const abort = new AbortController();
  const cancelled = requests.run("/cancel", "GET", abort.signal, async () => {
    throw Error("must not run");
  });
  const rejected = assert.rejects(
    cancelled,
    (error) => error instanceof AppError && error.kind === "session",
  );
  abort.abort();
  const third = read();
  assert.equal(calls, 2);
  releases.shift()!();
  await first;
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(calls, 3);
  releases.splice(0).forEach((release) => release());
  await Promise.all([second, third, rejected]);
});

test("a generic request limit blocks new reads/writes until reset without replay", async () => {
  let now = 1000,
    calls = 0;
  const requests = new RequestCoordinator(() => now);
  const error = new AppError("http", 429, "RATE_LIMITED", 61000);
  await assert.rejects(
    requests.run("/conversations", "GET", undefined, async () => {
      calls++;
      throw error;
    }),
  );
  await assert.rejects(
    requests.run("/different", "GET", undefined, async () => {
      calls++;
    }),
  );
  await assert.rejects(
    requests.run("/save", "POST", undefined, async () => {
      calls++;
    }),
  );
  assert.equal(calls, 1);
  now = 61000;
  await requests.run("/different", "GET", undefined, async () => {
    calls++;
  });
  assert.equal(calls, 2);
});

test("business/auth/unknown quotas do not become an app-wide ban", () => {
  const requests = new RequestCoordinator(() => 1000);
  requests.record(
    "/conversations/id/messages",
    "POST",
    new AppError("http", 429, "CHAT_RATE_LIMIT"),
  );
  requests.check("/conversations");
  requests.record(
    "/auth/login",
    "POST",
    new AppError("http", 429, "RATE_LIMITED"),
  );
  requests.check("/conversations");
  assert.throws(() => requests.check("/auth/login", "POST"));
  requests.record(
    "/events",
    "GET",
    new AppError("http", 429, "EVENT_CONNECTION_LIMIT"),
  );
  requests.check("/conversations");
  assert.throws(() => requests.check("/events"));
});

test("HTTP keeps retry time, does not renew on 429, and clears private cooldown on a new session", async () => {
  let calls = 0,
    renewals = 0,
    generation = 1;
  const client = createHttpClient(
    () => "https://fixture.test",
    axios.create({
      adapter: async (config) => {
        calls++;
        return {
          config,
          status: 429,
          statusText: "",
          headers: { "retry-after": "120" },
          data: { success: false, message: "RATE_LIMITED" },
        };
      },
    }),
  );
  client.bindSession({
    get generation() {
      return generation;
    },
    getToken: async () => "token",
    renew: async () => {
      renewals++;
    },
    expire: async () => {},
  });
  const before = Date.now();
  await assert.rejects(
    client.request("/conversations", { authenticated: true }),
    (error) => error instanceof AppError && error.retryAt >= before + 120000,
  );
  await assert.rejects(client.request("/different", { authenticated: true }));
  assert.equal(calls, 1);
  assert.equal(renewals, 0);
  generation++;
  await assert.rejects(client.request("/different", { authenticated: true }));
  assert.equal(calls, 2);
});

test("queued reads from the old session never reach transport after an account switch", async () => {
  let generation = 1,
    calls = 0;
  const releases: (() => void)[] = [];
  const client = createHttpClient(
    () => "https://fixture.test",
    axios.create({
      adapter: async (config) => {
        calls++;
        if (calls <= 4)
          await new Promise<void>((resolve) => releases.push(resolve));
        return {
          config,
          status: 200,
          statusText: "",
          headers: {},
          data: { success: true, data: "ok" },
        };
      },
    }),
  );
  client.bindSession({
    get generation() {
      return generation;
    },
    getToken: async () => "token",
    renew: async () => {},
    expire: async () => {},
  });
  const pending = Array.from({ length: 5 }, (_, index) =>
    client
      .request(`/read/${index}`, { authenticated: true })
      .catch((error: unknown) => error),
  );
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(calls, 4);
  generation++;
  releases.forEach((resolve) => resolve());
  const failures = await Promise.all(pending);
  assert.ok(
    failures.every(
      (error) => error instanceof AppError && error.kind === "session",
    ),
  );
  assert.equal(calls, 4);
  assert.equal(
    await client.request("/new-session", { authenticated: true }),
    "ok",
  );
  assert.equal(calls, 5);
});
