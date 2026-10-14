import assert from "node:assert/strict";
import test from "node:test";
import { QueryClient } from "@tanstack/react-query";
import {
  sessionsFixture,
  httpError,
  sessionId,
  teacherId,
  now,
} from "./fixtures/sessions-client";
import { sessionReadGuard } from "../src/features/sessions/utils/session-read";
import {
  canConfirmSession,
  confirmationLabel,
} from "../src/features/sessions/utils/session-policy";

test("detail validates UUID/identity/participant and strips provider metadata", async () => {
  const f = sessionsFixture();
  f.handler = async () => ({
    ...f.record,
    roomMetadata: { private: "hidden" },
    teacherAttendanceSeconds: "100",
  });
  const detail = await f.api.detail(sessionId);
  assert.equal("roomMetadata" in detail, false);
  assert.equal("teacherAttendanceSeconds" in detail, false);
  await assert.rejects(f.api.detail("demo-session"));
  f.handler = async () => ({ ...f.record, id: teacherId });
  await assert.rejects(f.api.detail(sessionId));
});
test("403/404 denial persists through transient errors and clears only on a valid read", async () => {
  const client = new QueryClient();
  const key = ["sessions", teacherId, 1, "detail", sessionId];
  const guard = sessionReadGuard(client, key);
  const f = sessionsFixture();
  await client.fetchQuery({
    queryKey: key,
    meta: { sessionReadGuard: guard },
    queryFn: () => guard.read(() => f.api.detail(sessionId)),
  });
  for (const status of [403, 404]) {
    await assert.rejects(
      guard.read(async () => {
        throw httpError(status);
      }),
    );
    await assert.rejects(
      guard.read(async () => {
        throw httpError(503);
      }),
    );
    assert.ok(sessionReadGuard(client, key).denial);
    await guard.read(() => f.api.detail(sessionId));
    assert.equal(guard.denial, undefined);
  }
  client.clear();
});
test("old generation results and unknown confirmation cannot authorize commands", async () => {
  const f = sessionsFixture();
  f.handler = async () => {
    f.changeAccount();
    return f.record;
  };
  await assert.rejects(f.api.detail(sessionId));
  const g = sessionsFixture();
  g.record.teacherConfirmationStatus = "UNRECOGNIZED";
  assert.equal(canConfirmSession(g.record, teacherId, now), false);
  assert.equal(
    confirmationLabel(g.record.teacherConfirmationStatus),
    "Chưa xác định",
  );
});
