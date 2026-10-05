import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequestContext } from "../dist/shared/http/request-context.js";

test("request IDs are server generated and correlation IDs are strict", () => {
  const correlationId = "123e4567-e89b-42d3-a456-426614174000";
  const first = createRequestContext({ "x-correlation-id": correlationId });
  const second = createRequestContext({ "x-correlation-id": correlationId });
  assert.equal(first.correlationId, correlationId);
  assert.notEqual(first.requestId, second.requestId);
  for (const invalid of [
    undefined,
    [correlationId, correlationId],
    "x\r\ny",
    "x".repeat(200),
  ]) {
    const context = createRequestContext({ "x-correlation-id": invalid });
    assert.match(context.correlationId, /^[0-9a-f-]{36}$/);
    assert.notEqual(context.correlationId, invalid);
  }
});
