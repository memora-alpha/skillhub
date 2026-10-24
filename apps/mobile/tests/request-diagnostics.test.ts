import assert from "node:assert/strict";
import test from "node:test";
import axios from "axios";
import {
  createRequestDiagnostics,
  requestDiagnostics,
} from "../src/lib/http/request-diagnostics";
import { createHttpClient } from "../src/lib/http/client";
import { AppError } from "../src/lib/http/errors";

test("technical logs redact IDs/query values, suppress local cooldown and repeated failures", () => {
  let now = 1000;
  const lines: string[] = [];
  const trace = createRequestDiagnostics(
    () => true,
    (line) => lines.push(line),
    () => now,
  );
  const path =
    "/conversations/12345678-1234-1234-1234-123456789abc/messages?token=private&cursor=secret";
  const error = new AppError("http", 429, "RATE_LIMITED", 61000);
  trace.failed(path, "GET", error, "server");
  trace.failed(path, "GET", error, "server");
  trace.failed("/sessions/mine?from=private", "GET", error, "client-cooldown");
  assert.equal(lines.length, 1);
  assert.equal(/private|secret|12345678/.test(lines.join()), false);
  assert.deepEqual(JSON.parse(lines[0]!), {
    request: "GET /conversations/:id/messages",
    status: 429,
    kind: "http",
    code: "RATE_LIMITED",
    clientWaitSeconds: 60,
  });
  now = 62000;
  trace.failed(
    "/profiles/alice@example.com",
    "GET",
    new AppError("http", 503, "private text"),
    "server",
  );
  assert.equal(lines.join().includes("alice"), false);
  assert.equal(JSON.parse(lines.at(-1)!).code, "UNKNOWN");
  trace.failed("/events", "GET", new AppError("network"), "server");
  assert.equal(JSON.parse(lines.at(-1)!).kind, "network");
});

test("production and normal business failures do not emit diagnostic logs", () => {
  const lines: string[] = [];
  const trace = createRequestDiagnostics(
    () => false,
    (line) => lines.push(line),
  );
  trace.failed("/profiles/private", "GET", new AppError("http", 429), "server");
  assert.equal(lines.length, 0);
  const dev = createRequestDiagnostics(
    () => true,
    (line) => lines.push(line),
  );
  dev.failed("/profiles/private", "GET", new AppError("http", 403), "server");
  dev.failed("/profiles/private", "GET", new AppError("session"), "server");
  assert.equal(lines.length, 0);
});

test("HTTP reports actual transport failures while cooldown does not send extra requests", async (t) => {
  const reports: string[] = [];
  let calls = 0;
  t.mock.method(
    requestDiagnostics,
    "failed",
    (path: string, _method: string, _error: unknown, source: string) =>
      reports.push(`${source}:${path}`),
  );
  const client = createHttpClient(
    () => "https://fixture.test",
    axios.create({
      adapter: async (config) => {
        calls++;
        return {
          config,
          status: 429,
          statusText: "",
          headers: { "retry-after": "60" },
          data: { success: false, message: "RATE_LIMITED" },
        };
      },
    }),
  );
  await assert.rejects(client.request("/conversations"));
  await assert.rejects(client.request("/sessions/mine"));
  assert.equal(calls, 1);
  assert.deepEqual(reports, [
    "server:/conversations",
    "client-cooldown:/sessions/mine",
  ]);
});
