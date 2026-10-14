import assert from "node:assert/strict";
import test from "node:test";
import { sessionsFixture, now } from "./fixtures/sessions-client";
import {
  sessionRange,
  sessionDay,
  sessionGroup,
  listIsLimited,
} from "../src/features/sessions/utils/session-time";
import { sessionReadState } from "../src/features/sessions/utils/session-read";

test("session list uses the existing transport and rejects participant/role mismatches", async () => {
  const f = sessionsFixture();
  assert.equal(
    (
      await f.api.list({
        from: "2026-10-01T00:00:00Z",
        to: "2026-10-31T23:59:59Z",
      })
    )[0]?.id,
    f.record.id,
  );
  f.record.role = "LEARNER";
  await assert.rejects(
    f.api.list({ from: "2026-10-01T00:00:00Z", to: "2026-10-31T23:59:59Z" }),
  );
  f.record.role = "TEACHER";
  f.record.teacherId = "10000000-0000-4000-8000-000000000009";
  await assert.rejects(
    f.api.list({ from: "2026-10-01T00:00:00Z", to: "2026-10-31T23:59:59Z" }),
  );
});
test("month/day UTC boundaries stay inclusive and midnight follows display timezone", () => {
  assert.deepEqual(sessionRange(2026, 9, null, "UTC"), {
    from: "2026-10-01T00:00:00.000Z",
    to: "2026-10-31T23:59:59.999Z",
  });
  assert.deepEqual(sessionRange(2026, 9, 14, "Asia/Ho_Chi_Minh"), {
    from: "2026-10-13T17:00:00.000Z",
    to: "2026-10-14T16:59:59.999Z",
  });
  assert.equal(sessionDay("2026-10-13T18:00:00Z", "Asia/Ho_Chi_Minh"), 14);
  assert.equal(sessionDay("2026-10-13T18:00:00Z", "UTC"), 13);
});
test("display grouping does not invent a Session transition and cap is explicit", () => {
  const f = sessionsFixture();
  assert.equal(sessionGroup(f.record, now), "history");
  assert.equal(f.record.status, "CONFIRMED");
  assert.equal(listIsLimited(Array(100)), true);
  assert.equal(listIsLimited(Array(99)), false);
});
test("missing/loading/error state never substitutes sample or empty data", () => {
  assert.equal(sessionReadState(undefined, false, undefined), "prerequisite");
  assert.equal(sessionReadState(undefined, true, undefined), "loading");
  assert.equal(
    sessionReadState(undefined, true, new Error("offline")),
    "error",
  );
  assert.equal(sessionReadState([], true, undefined), "content");
});
