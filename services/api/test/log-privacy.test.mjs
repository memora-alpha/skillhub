import assert from "node:assert/strict";
import { test } from "node:test";
import {
  requestLogId,
  requestLogProperties,
  safeRequestLog,
} from "../dist/configs/logging.config.js";

test("request logging keeps IDs and omits query secrets and headers", () => {
  const headers = {
    "x-correlation-id": "123e4567-e89b-42d3-a456-426614174000",
    authorization: "Bearer secret",
  };
  const request = { headers, method: "GET", url: "/api/files?token=sensitive" };
  const responseHeaders = new Map();
  const response = {
    setHeader: (name, value) => responseHeaders.set(name, value),
  };
  const requestId = requestLogId(request, response);
  assert.equal(responseHeaders.get("x-request-id"), requestId);
  assert.equal(
    responseHeaders.get("x-correlation-id"),
    headers["x-correlation-id"],
  );
  assert.equal(
    requestLogProperties(request).correlationId,
    headers["x-correlation-id"],
  );
  const entry = safeRequestLog({ ...request, id: requestId });
  assert.deepEqual(entry, { id: requestId, method: "GET", path: "/api/files" });
  assert.ok(!JSON.stringify(entry).includes("sensitive"));
  assert.ok(!JSON.stringify(entry).includes("secret"));
});
