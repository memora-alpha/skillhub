import assert from "node:assert/strict";
import test from "node:test";
import { AppError } from "../src/lib/http/errors";
import { startLearningRequestsFixture } from "./fixtures/learning-requests-api";
import { fixtureClient } from "./fixtures/learning-requests-client";
import { fixtureId } from "./fixtures/learning-requests-data";

test("loopback fixture returns separate actors and two canonical pages", async (t) => {
  const fixture = await startLearningRequestsFixture();
  t.after(fixture.stop);
  const api = fixtureClient(fixture.url);
  const first = await api.list("mine");
  assert.equal(first.items.length, 20);
  assert.ok(first.nextCursor);
  const second = await api.list("mine", {}, first.nextCursor!);
  assert.equal(second.items.length, 5);
  assert.equal(second.nextCursor, null);
  const other = await fixtureClient(fixture.url, 1).list("mine");
  assert.equal(
    first.items.some((a) => other.items.some((b) => a.id === b.id)),
    false,
  );
});

for (const command of ["edit", "publish", "cancel"] as const) {
  test(`${command} rejects a valid owner projection for the wrong target ID`, async (t) => {
    const fixture = await startLearningRequestsFixture();
    t.after(fixture.stop);
    const api = fixtureClient(fixture.url);
    const id = fixtureId(100);
    await fixture.control({
      rules: [
        {
          kind: "wrong-id",
          method: command === "edit" ? "PATCH" : "POST",
          path: `/api/v1/learning-requests/${id}${command === "edit" ? "" : `/${command}`}`,
        },
      ],
    });
    const mutate = () =>
      command === "edit"
        ? api.edit(id, { expectedVersion: 1, title: "Một tiêu đề mới đủ dài" })
        : api.action(id, command, 1);
    await assert.rejects(
      mutate,
      (error: unknown) =>
        error instanceof AppError && error.kind === "protocol",
    );
    assert.equal(fixture.events.filter((e) => e.method !== "GET").length, 1);
  });
}

test("correct target/version succeeds and a late session response never becomes success", async (t) => {
  const fixture = await startLearningRequestsFixture();
  t.after(fixture.stop);
  let current = true;
  const api = fixtureClient(fixture.url, 0, () => current);
  const result = await api.edit(fixtureId(100), {
    expectedVersion: 1,
    title: "Tiêu đề cập nhật hợp lệ",
  });
  assert.equal(result.id, fixtureId(100));
  assert.equal(result.version, 2);
  await fixture.control({
    rules: [{ kind: "delay", method: "PATCH", delayMs: 40 }],
  });
  const pending = api.edit(result.id, {
    expectedVersion: 2,
    learningGoal: "Mục tiêu tiếp theo của tôi",
  });
  current = false;
  await assert.rejects(
    pending,
    (error: unknown) => error instanceof AppError && error.kind === "session",
  );
});

test("a correct target with an unsafe response version is still a protocol failure", async (t) => {
  const fixture = await startLearningRequestsFixture();
  t.after(fixture.stop);
  const api = fixtureClient(fixture.url),
    id = fixtureId(100);
  await fixture.control({ update: { id, version: Number.MAX_SAFE_INTEGER } });
  await assert.rejects(
    () =>
      api.edit(id, {
        expectedVersion: Number.MAX_SAFE_INTEGER,
        title: "Một tiêu đề cập nhật hợp lệ",
      }),
    (error: unknown) => error instanceof AppError && error.kind === "protocol",
  );
});

test("403/429/503 remain explicit errors and do not silently resend a mutation", async (t) => {
  const fixture = await startLearningRequestsFixture();
  t.after(fixture.stop);
  const api = fixtureClient(fixture.url),
    id = fixtureId(100);
  for (const [status, code] of [
    [403, "FORBIDDEN"],
    [403, "NEW_ACTIVITY_RESTRICTED"],
    [429, "TOO_MANY_REQUESTS"],
    [503, "DEPENDENCY_UNAVAILABLE"],
  ] as const) {
    const before = fixture.events.length;
    await fixture.control({
      rules: [{ kind: "http", method: "PATCH", status, code }],
    });
    await assert.rejects(
      () =>
        api.edit(id, {
          expectedVersion: 1,
          title: "Một tiêu đề cập nhật hợp lệ",
        }),
      (error: unknown) =>
        error instanceof AppError &&
        error.status === status &&
        error.code === code,
    );
    assert.equal(fixture.events.length, before + 1);
  }
});

test("unknown create outcome is not replayed or identified by a matching title", async (t) => {
  const fixture = await startLearningRequestsFixture();
  t.after(fixture.stop);
  const api = fixtureClient(fixture.url);
  await fixture.control({
    rules: [
      {
        kind: "unknown-commit",
        method: "POST",
        path: "/api/v1/learning-requests",
      },
    ],
  });
  await assert.rejects(
    () =>
      api.create({
        title: "Bản nháp có kết quả chưa xác nhận",
        skillId: fixtureId(10),
        description: "Mô tả nhu cầu học từ fixture để kiểm thử.",
        learningGoal: "Mục tiêu học của fixture",
        currentLevel: null,
        verifiedTeacherOnly: false,
        preferredSlots: [],
        expiresAt: null,
      }),
    (error: unknown) =>
      error instanceof AppError &&
      (error.kind === "network" || error.kind === "protocol"),
  );
  assert.equal(
    fixture.events.filter((event) => event.method === "POST").length,
    1,
  );
  const saved = await api.list("mine");
  assert.equal(saved.items.length, 20);
});
