import test from "node:test";
import assert from "node:assert/strict";
import axios, { AxiosError, CanceledError } from "axios";
import {
  createConnectionStore,
  connectionStore,
  deviceOffline,
} from "../src/lib/network/connection-store";
import { createHttpClient } from "../src/lib/http/client";
import { AppError } from "../src/lib/http/errors";

function resetConnection() {
  const ticket = connectionStore.beginRetry();
  if (ticket !== null) connectionStore.finishRetry(ticket, true);
}
test("connectivity recovery is locked and must complete before hiding the global page", () => {
  const store = createConnectionStore();
  store.unavailable();
  const ticket = store.beginRetry()!;
  assert.equal(store.beginRetry(), null);
  assert.equal(store.getSnapshot().retrying, true);
  store.finishRetry(ticket, true);
  assert.deepEqual(store.getSnapshot(), { reason: null, retrying: false });
});
test("a new failure during reload keeps the global page visible", () => {
  const store = createConnectionStore();
  store.unavailable();
  const ticket = store.beginRetry()!;
  store.unavailable();
  store.finishRetry(ticket, true);
  assert.deepEqual(store.getSnapshot(), {
    reason: "unreachable",
    retrying: false,
  });
});
test("device reconnect moves from offline to checking the service without clearing early", () => {
  const store = createConnectionStore();
  store.unavailable("offline");
  store.deviceConnected();
  assert.equal(store.getSnapshot().reason, "unreachable");
  assert.equal(deviceOffline({}), false);
  assert.equal(deviceOffline({ isConnected: true }), false);
  assert.equal(
    deviceOffline({ isConnected: true, isInternetReachable: false }),
    true,
  );
});
test("HTTP network failure reports to the app-wide connection store", async () => {
  resetConnection();
  const client = createHttpClient(
    () => "https://fixture.test/api/v1",
    axios.create({
      adapter: async () => {
        throw new AxiosError("offline", "ERR_NETWORK");
      },
    }),
  );
  await assert.rejects(
    client.request("/example"),
    (error) => error instanceof AppError && error.kind === "network",
  );
  assert.equal(connectionStore.getSnapshot().reason, "unreachable");
  resetConnection();
});
test("business HTTP error does not activate the offline page", async () => {
  resetConnection();
  const client = createHttpClient(
    () => "https://fixture.test/api/v1",
    axios.create({
      adapter: async (config) => ({
        config,
        status: 503,
        statusText: "",
        headers: {},
        data: { success: false, message: "SERVICE_UNAVAILABLE" },
      }),
    }),
  );
  await assert.rejects(
    client.request("/example"),
    (error) => error instanceof AppError && error.status === 503,
  );
  assert.equal(connectionStore.getSnapshot().reason, null);
});
test("canceled request does not activate the offline page", async () => {
  resetConnection();
  const client = createHttpClient(
    () => "https://fixture.test/api/v1",
    axios.create({
      adapter: async () => {
        throw new CanceledError("canceled");
      },
    }),
  );
  await assert.rejects(
    client.request("/example"),
    (error) => error instanceof AppError && error.kind === "session",
  );
  assert.equal(connectionStore.getSnapshot().reason, null);
});
test("late failure from a replaced session does not block the current account", async () => {
  resetConnection();
  let fail!: (error: Error) => void;
  const deferred = new Promise<never>((_, reject) => {
    fail = reject;
  });
  const client = createHttpClient(
    () => "https://fixture.test/api/v1",
    axios.create({ adapter: () => deferred }),
  );
  let generation = 1;
  client.bindSession({
    get generation() {
      return generation;
    },
    getToken: async () => "fixture",
    renew: async () => {},
    expire: async () => {},
  });
  const request = client.request("/example", { authenticated: true });
  await new Promise<void>((resolve) => setImmediate(resolve));
  generation++;
  fail(new AxiosError("offline", "ERR_NETWORK"));
  await assert.rejects(
    request,
    (error) => error instanceof AppError && error.kind === "session",
  );
  assert.equal(connectionStore.getSnapshot().reason, null);
});
