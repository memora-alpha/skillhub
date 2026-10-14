import assert from "node:assert/strict";
import test from "node:test";
import { createCompletionAction } from "../src/features/sessions/utils/completion-action";
import {
  sessionsFixture,
  teacherId,
  sessionId,
  now,
  httpError,
} from "./fixtures/sessions-client";

function action(f: ReturnType<typeof sessionsFixture>) {
  return createCompletionAction({
    api: f.api,
    userId: teacherId,
    sessionId,
    now: () => now,
    isCurrent: () => f.generation === 1,
    onDetail: async () => {},
  });
}
const postCount = (f: ReturnType<typeof sessionsFixture>) =>
  f.calls.filter((c) => c.method === "POST").length;

test("one confirmation waits; server two confirmations completes; double tap sends once", async () => {
  const f = sessionsFixture(),
    a = action(f);
  await Promise.all([a.run(), a.run()]);
  assert.equal(postCount(f), 1);
  assert.equal(a.getSnapshot().detail?.status, "AWAITING_CONFIRMATION");
  const g = sessionsFixture();
  g.record.learnerConfirmationStatus = "CONFIRMED";
  const b = action(g);
  await b.run();
  assert.equal(b.getSnapshot().detail?.status, "COMPLETED");
  assert.equal(
    g.calls.some((c) => c.path.includes("settlement")),
    false,
  );
});
test("pre-end and disputed sessions never send completion", async () => {
  for (const state of ["future", "DISPUTED", "CANCELLED"]) {
    const f = sessionsFixture();
    if (state === "future") f.record.endAt = "2026-10-14T09:00:00Z";
    else f.record.status = state;
    await action(f).run();
    assert.equal(postCount(f), 0);
  }
});
test("401 renewal never automatically replays the POST", async () => {
  const f = sessionsFixture(),
    load = f.handler;
  f.handler = async (path, method, body) => {
    if (method === "POST") throw httpError(401);
    return load(path, method, body);
  };
  await action(f).run();
  assert.equal(postCount(f), 1);
});
test("uncertain POST must reconcile before retry and committed confirmation is not resent", async () => {
  const f = sessionsFixture(),
    load = f.handler;
  f.handler = async (path, method, body) => {
    const result = await load(path, method, body);
    if (method === "POST") throw httpError(503);
    return result;
  };
  const a = action(f);
  await a.run();
  await a.run();
  assert.equal(postCount(f), 1);
  assert.equal(a.getSnapshot().blocked, true);
  await a.refresh();
  await a.run();
  assert.equal(postCount(f), 1);
  assert.equal(a.getSnapshot().detail?.teacherConfirmationStatus, "CONFIRMED");
});
test("successful receipt survives a failed detail refresh without allowing resend", async () => {
  const f = sessionsFixture(),
    load = f.handler;
  let committed = false;
  f.handler = async (path, method, body) => {
    if (method === "GET" && committed) throw httpError(503);
    const result = await load(path, method, body);
    if (method === "POST") committed = true;
    return result;
  };
  const a = action(f);
  await a.run();
  await a.run();
  assert.ok(a.getSnapshot().receipt);
  assert.equal(postCount(f), 1);
});
test("account change discards old mutation outcomes", async () => {
  const f = sessionsFixture(),
    load = f.handler;
  f.handler = async (path, method, body) => {
    const result = await load(path, method, body);
    if (method === "POST") f.changeAccount();
    return result;
  };
  const a = action(f);
  await a.run();
  assert.equal(a.getSnapshot().receipt, undefined);
  assert.equal(a.getSnapshot().detail, undefined);
});
