import assert from "node:assert/strict";
import test from "node:test";
import { QueryClient } from "@tanstack/react-query";
import { AppError } from "../src/lib/http/errors";
import {
  RequestReadGuard,
  requestReadGuard,
} from "../src/features/learning-requests/utils/request-read";
import { startLearningRequestsFixture } from "./fixtures/learning-requests-api";
import { fixtureClient } from "./fixtures/learning-requests-client";
import { fixtureId } from "./fixtures/learning-requests-data";

for (const scope of ["own", "public"] as const) {
  test(`${scope} cached detail: read403/404 hides it until a successful GET, even after503`, async (t) => {
    const fixture = await startLearningRequestsFixture();
    t.after(fixture.stop);
    const api = fixtureClient(fixture.url, scope === "own" ? 0 : 1);
    const id = fixtureId(100),
      path = `/api/v1/learning-requests/${id}`;
    const guard = new RequestReadGuard();
    const cache = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    t.after(() => cache.clear());
    const read = () =>
      cache.fetchQuery({
        queryKey: [scope, id],
        queryFn: () => guard.read(() => api.detail(id)),
      });
    await read();
    for (const status of [404, 403]) {
      await fixture.control({
        rules: [
          { kind: "http", method: "GET", path, status, code: "NOT_AVAILABLE" },
        ],
      });
      await assert.rejects(read);
      assert.ok(cache.getQueryData([scope, id]));
      assert.equal(guard.denial, status === 404 ? "unavailable" : "forbidden");
      await fixture.control({
        rules: [{ kind: "http", method: "GET", path, status: 503 }],
      });
      await assert.rejects(read);
      assert.ok(guard.denial);
      await read();
      assert.equal(guard.denial, undefined);
    }
  });
}

test("transient refresh retains last-read reason; a successful edit clears the old reason", async (t) => {
  const fixture = await startLearningRequestsFixture();
  t.after(fixture.stop);
  const api = fixtureClient(fixture.url),
    id = fixtureId(101),
    guard = new RequestReadGuard();
  const rejected = await guard.read(() => api.detail(id));
  assert.ok(
    "moderationRejectReason" in rejected && rejected.moderationRejectReason,
  );
  await fixture.control({ rules: [{ kind: "network", method: "GET" }] });
  await assert.rejects(() => guard.read(() => api.detail(id)));
  assert.equal(guard.denial, undefined);
  const edited = await api.edit(id, {
    expectedVersion: rejected.version,
    learningGoal: "Mục tiêu được mô tả rõ hơn",
  });
  assert.equal(edited.moderationRejectReason, null);
  assert.equal(edited.status, "DRAFT");
});

test("an old read cannot reset denial or expose a response to a new session", async () => {
  const guard = new RequestReadGuard();
  await assert.rejects(() =>
    guard.read(async () => {
      throw new AppError("http", 404);
    }),
  );
  let release!: (value: string) => void;
  let current = true;
  const pending = guard.read(
    () =>
      new Promise<string>((resolve) => {
        release = resolve;
      }),
    () => current,
  );
  current = false;
  release("old private snapshot");
  await assert.rejects(
    pending,
    (error: unknown) => error instanceof AppError && error.kind === "session",
  );
  assert.equal(guard.denial, "unavailable");
});

test("read denial survives screen remount after a transient error, but not a new session", async (t) => {
  const fixture = await startLearningRequestsFixture();
  t.after(fixture.stop);
  const api = fixtureClient(fixture.url);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  t.after(() => client.clear());
  const key = [
    "learning-requests",
    "user-a",
    1,
    "detail",
    fixtureId(100),
  ] as const;
  const initial = requestReadGuard(client, key);
  const read = () =>
    client.fetchQuery({
      queryKey: key,
      meta: { requestReadGuard: initial },
      queryFn: () => initial.read(() => api.detail(fixtureId(100))),
    });
  await read();
  for (const status of [403, 503]) {
    await fixture.control({ rules: [{ kind: "http", method: "GET", status }] });
    await assert.rejects(read);
  }
  const remounted = requestReadGuard(client, key);
  assert.equal(remounted.denial, "forbidden");
  assert.equal(remounted, initial);
  assert.equal(
    requestReadGuard(client, [
      "learning-requests",
      "user-b",
      2,
      "detail",
      fixtureId(100),
    ]).denial,
    undefined,
  );
  await read();
  assert.equal(remounted.denial, undefined);
});
