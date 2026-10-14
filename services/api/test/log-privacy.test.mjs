import assert from "node:assert/strict";
import { test } from "node:test";
import {
  requestLogId,
  requestLogProperties,
  safeRequestLog,
  safeServerErrorLog,
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

test("server diagnostics never serialize arbitrary messages or database detail values", () => {
  const error = new Error(
    "postgresql://user:private-password@localhost/db\n    at private-token",
  );
  error.meta = {
    driverAdapterError: {
      cause: {
        originalCode: "23505",
        originalMessage: "Key (email)=(private-email) already exists",
      },
    },
  };
  const diagnostic = safeServerErrorLog(error);
  assert.equal(diagnostic.errorType, "Error");
  assert.equal(diagnostic.databaseCode, "23505");
  assert.equal(diagnostic.missingColumn, undefined);
  assert.ok(diagnostic.stackFrames.length > 0);
  assert.ok(diagnostic.stackFrames.length <= 8);
  assert.doesNotMatch(JSON.stringify(diagnostic), /private-|postgresql/);
  error.meta.driverAdapterError.cause.originalCode = "42703";
  error.meta.driverAdapterError.cause.originalMessage =
    "column private-password with private-token does not exist";
  assert.equal(safeServerErrorLog(error).missingColumn, undefined);
  assert.equal(
    safeServerErrorLog("private-password").errorType,
    "UnknownError",
  );
});
