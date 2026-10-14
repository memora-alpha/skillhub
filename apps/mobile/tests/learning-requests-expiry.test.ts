import assert from "node:assert/strict";
import test from "node:test";
import { AppError } from "../src/lib/http/errors";
import {
  needsExpiryRead,
  requestPreflight,
} from "../src/features/learning-requests/utils/request-preflight";
import { fixtureRequest } from "./fixtures/learning-requests-data";

const now = Date.parse("2035-01-01T12:00:00Z");
const expired = () =>
  fixtureRequest({ expiresAt: "2035-01-01T11:59:59Z" }, now);

test("editor deep link and edit submit preflight read expiry instead of locally expiring", async () => {
  const request = expired();
  let reads = 0;
  const outcome = await requestPreflight(
    request,
    "edit",
    async () => {
      reads++;
      return { ...request, effectiveStatus: "EXPIRED" };
    },
    () => true,
    now,
  );
  assert.equal(reads, 1);
  assert.equal(outcome.kind, "readonly");
  assert.equal(request.status, "OPEN");
  assert.equal(request.effectiveStatus, undefined);
});
test("deadline crossed while form is open triggers read and changed version requires comparison", async () => {
  const request = expired();
  assert.equal(needsExpiryRead(request, now - 2_000), false);
  assert.equal(needsExpiryRead(request, now), true);
  const outcome = await requestPreflight(
    request,
    "edit",
    async () => ({ ...request, version: 2 }),
    () => true,
    now,
  );
  assert.equal(outcome.kind, "changed");
  assert.equal(request.version, 1);
});
test("read failures propagate before mutation for network503404403", async () => {
  for (const error of [
    new AppError("network"),
    new AppError("http", 503),
    new AppError("http", 404),
    new AppError("http", 403),
  ]) {
    await assert.rejects(
      () =>
        requestPreflight(
          expired(),
          "edit",
          async () => {
            throw error;
          },
          () => true,
          now,
        ),
      (actual: unknown) => actual === error,
    );
  }
});
test("clock ahead permits one server-authoritative read without a refresh loop", async () => {
  const request = expired();
  let reads = 0;
  const outcome = await requestPreflight(
    request,
    "cancel",
    async () => {
      reads++;
      return request;
    },
    () => true,
    now,
  );
  assert.equal(outcome.kind, "ready");
  assert.equal(reads, 1);
});
test("NEGOTIATING can cancel without local expiry; terminal states stay read-only", async () => {
  for (const status of ["NEGOTIATING", "MATCHED", "CLOSED"] as const) {
    const request = { ...expired(), status };
    assert.equal(needsExpiryRead(request, now), false);
    const outcome = await requestPreflight(
      request,
      "cancel",
      async () => {
        throw Error("Unexpected local expiry read");
      },
      () => true,
      now,
    );
    assert.equal(outcome.kind, status === "NEGOTIATING" ? "ready" : "readonly");
  }
});
test("a preflight result from a previous session is discarded", async () => {
  let current = true;
  await assert.rejects(
    () =>
      requestPreflight(
        expired(),
        "edit",
        async () => {
          current = false;
          return expired();
        },
        () => current,
        now,
      ),
    (error: unknown) => error instanceof AppError && error.kind === "session",
  );
});
