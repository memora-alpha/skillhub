import assert from "node:assert/strict";
import test from "node:test";
import axios from "axios";
import { createHttpClient } from "../src/lib/http/client";
import { AppError } from "../src/lib/http/errors";
import { createPaymentPreparation } from "./fixtures/wallet-model-intent";

// In-memory Axios adapter, existing /me read path: NOT a Payment endpoint/DTO fixture.
test("inert boundary forwards immutable intent and replay opt-out; shared 401 renews once without resend", async () => {
  let sends = 0,
    renewals = 0,
    dispatches = 0;
  const client = createHttpClient(
    () => "https://transport.invalid/api/v1",
    axios.create({
      adapter: async (config) => {
        sends++;
        assert.equal(config.url, "/me");
        assert.equal(config.data, undefined);
        return {
          config,
          status: 401,
          statusText: "",
          headers: {},
          data: { success: false, message: "INVALID_TOKEN" },
        };
      },
    }),
  );
  client.bindSession({
    generation: 1,
    getToken: async () => "synthetic",
    renew: async () => {
      renewals++;
    },
    expire: async () => {
      throw new Error("must not expire");
    },
  });
  const model = createPaymentPreparation({
    scope: { ownerId: "synthetic-a", generation: 1 },
    isCurrent: () => true,
  });
  model.edit("2000");
  model.review();
  await model.confirmModel(async (intent, options) => {
    dispatches++;
    assert(Object.isFrozen(intent.review));
    assert.equal(options.retry, false);
    assert.equal(options.replayAfterRenewal, false);
    return client.request("/me", {
      authenticated: true,
      signal: options.signal,
      replayAfterRenewal: options.replayAfterRenewal,
    });
  });
  assert.equal(sends, 1);
  assert.equal(renewals, 1);
  assert.equal(dispatches, 1);
  assert.equal(model.getSnapshot().stage, "UNKNOWN_OUTCOME");
  await model.confirmModel(async () => {
    dispatches++;
    return {};
  });
  assert.equal(dispatches, 1);
});

test("HTTP codes and malformed 2xx are never proof of no creation; no implicit retry or new local identity", async () => {
  for (const failure of [
    new AppError("http", 409),
    new AppError("http", 429),
    new AppError("http", 500),
    new AppError("http", 503),
    new AppError("protocol"),
    new AppError("network"),
  ]) {
    const model = createPaymentPreparation({
      scope: { ownerId: "a", generation: 1 },
      isCurrent: () => true,
    });
    model.edit("2000");
    model.review();
    let calls = 0;
    await model.confirmModel(async () => {
      calls++;
      throw failure;
    });
    const intent = model.getSnapshot().intent;
    model.startNext();
    model.edit("2000");
    model.review();
    await model.confirmModel(async () => {
      calls++;
      return {};
    });
    assert.equal(calls, 1);
    assert.equal(model.getSnapshot().intent, intent);
    assert.equal(model.getSnapshot().stage, "UNKNOWN_OUTCOME");
  }
});
