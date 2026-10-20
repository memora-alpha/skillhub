import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { proxyEvents } from "../src/lib/staff/event-proxy";
import { staffGateway } from "../src/lib/staff/server";
import { refreshStaffSession, staffApi } from "../src/lib/staff/client";

test("SSE proxy forwards safe cursor/bearer, streams bytes immediately and cancels upstream", async () => {
  let cancelled = false,
    upstreamSignal: AbortSignal | undefined;
  const transport: typeof fetch = async (input, options) => {
    assert.equal(String(input), "https://api.fixture.test/api/v1/events");
    const headers = new Headers(options?.headers);
    assert.equal(headers.get("Authorization"), "Bearer fixture-only-token");
    assert.equal(headers.get("Last-Event-ID"), "opaque-cursor");
    assert.equal(options?.redirect, "error");
    upstreamSignal = options?.signal ?? undefined;
    return new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(": heartbeat\n\n"));
        },
        cancel() {
          cancelled = true;
        },
      }),
      {
        headers: {
          "Content-Type": "text/event-stream",
          "Set-Cookie": "private=fixture",
        },
      },
    );
  };
  const result = await proxyEvents(
    new Request("http://localhost/api/staff/events", {
      headers: { "Last-Event-ID": "opaque-cursor" },
    }),
    new URL("https://api.fixture.test/api/v1/events"),
    "fixture-only-token",
    transport,
  );
  assert.equal(result.headers.get("Set-Cookie"), null);
  assert.equal(result.headers.get("X-Accel-Buffering"), "no");
  const reader = result.body!.getReader();
  assert.equal(
    new TextDecoder().decode((await reader.read()).value),
    ": heartbeat\n\n",
  );
  await reader.cancel();
  assert.equal(cancelled, true);
  assert.equal(upstreamSignal?.aborted, true);
});
test("SSE proxy maps setup errors, rejects invalid cursors/types and never leaks upstream payloads", async () => {
  for (const [status, message] of [
    [401, "SESSION_UNAVAILABLE"],
    [403, "EVENT_ACCESS_DENIED"],
    [409, "EVENT_CURSOR_EXPIRED"],
    [429, "EVENT_CAPACITY_EXCEEDED"],
  ] as const) {
    const response = await proxyEvents(
      new Request("http://localhost/api/admin/events"),
      new URL("https://api.fixture.test/events"),
      "fixture",
      async () => new Response("private upstream details", { status }),
    );
    assert.equal(response.status, status);
    assert.equal((await response.json()).message, message);
  }
  const response = await proxyEvents(
    new Request("http://localhost/api/admin/events", {
      headers: { "Last-Event-ID": "x".repeat(1025) },
    }),
    new URL("https://api.fixture.test/events"),
    "fixture",
    async () => {
      throw new Error("must not fetch");
    },
  );
  assert.equal(response.status, 400);
  const json = await proxyEvents(
    new Request("http://localhost/api/staff/events"),
    new URL("https://api.fixture.test/events"),
    "fixture",
    async () => Response.json({ secret: "fixture" }),
  );
  assert.equal(json.status, 502);
});
test("Staff/Admin gateways isolate cookie tokens and reject wrong portal roles before connecting", async (t) => {
  const original = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = original;
  });
  let events = 0;
  globalThis.fetch = async (input, options) => {
    const path = new URL(String(input)).pathname;
    const token = new Headers(options?.headers).get("Authorization");
    if (path.endsWith("/me"))
      return Response.json({
        success: true,
        data: {
          userId: "10000000-0000-4000-8000-000000000001",
          accountStatus: "ACTIVE",
          emailVerified: true,
          roles: [token === "Bearer admin-fixture" ? "ADMIN" : "STAFF"],
          profile: { fullName: "Fixture" },
        },
      });
    events++;
    return new Response(": heartbeat\n\n", {
      headers: { "Content-Type": "text/event-stream" },
    });
  };
  for (const portal of ["staff", "admin"] as const) {
    const request = new NextRequest(`http://localhost/api/${portal}/events`, {
      headers: {
        Cookie: `skillhub_staff_access=staff-fixture; skillhub_admin_access=admin-fixture`,
      },
    });
    const response = await staffGateway(request, ["events"], portal);
    assert.equal(response.status, 200);
    await response.body?.cancel();
  }
  const denied = await staffGateway(
    new NextRequest("http://localhost/api/admin/events", {
      headers: { Cookie: "skillhub_admin_access=staff-fixture" },
    }),
    ["events"],
    "admin",
  );
  assert.equal(denied.status, 403);
  assert.equal(events, 2);
  const missing = await staffGateway(
    new NextRequest("http://localhost/api/staff/events"),
    ["events"],
  );
  assert.equal(missing.status, 401);
});
test("stream and concurrent REST renewals share one portal refresh request", async (t) => {
  const original = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = original;
  });
  let refreshes = 0,
    renewed = false,
    release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  globalThis.fetch = async (input) => {
    if (String(input).endsWith("session/refresh")) {
      refreshes++;
      await gate;
      renewed = true;
      return Response.json({ success: true, data: null });
    }
    if (!renewed)
      return Response.json(
        { success: false, message: "SESSION_EXPIRED" },
        { status: 401 },
      );
    return Response.json({ success: true, data: [] });
  };
  const streamRenewal = refreshStaffSession("staff");
  const rest = staffApi("notifications", {}, "staff");
  release();
  await Promise.all([streamRenewal, rest]);
  assert.equal(refreshes, 1);
});
