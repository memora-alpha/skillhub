import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  finalizedOneWay,
  setup,
  user,
  A,
  B,
  C,
} from "../learning-platform/fixtures.mjs";
import { LiveKitService } from "../../dist/modules/learning-sessions/infrastructure/livekit/livekit.service.js";
import { ConfigService } from "@nestjs/config";
import { TokenVerifier } from "livekit-server-sdk";
import { ServiceUnavailableException } from "@nestjs/common";

const config = {
  LIVEKIT_URL: "wss://example.livekit.cloud",
  LIVEKIT_API_KEY: "test-key",
  LIVEKIT_API_SECRET: "secret-key-long-enough-for-tests",
};
const participant = (id) => ({
  ...user(id),
  permissions: ["livekit-token:issue:participant"],
});
async function ready() {
  const ctx = setup({
    wallets: { [B]: 10000n },
    config: { "livekit.joinWindow": { earlyMinutes: 10, lateMinutes: 10 } },
  });
  const ids = await finalizedOneWay(ctx);
  ctx.clock.now = new Date(ids.session.startAt);
  ctx.sessions.livekit = new LiveKitService(new ConfigService(config));
  return { ...ctx, ...ids };
}

test("token is scoped to authenticated participant and room with bounded expiry", async () => {
  const ctx = await ready();
  const one = await ctx.sessions.issueLiveKitToken(
    participant(A),
    ctx.session.id,
  );
  const two = await ctx.sessions.issueLiveKitToken(
    participant(B),
    ctx.session.id,
  );
  const decoded = await new TokenVerifier(
    config.LIVEKIT_API_KEY,
    config.LIVEKIT_API_SECRET,
  ).verify(one.participantToken, 0);
  assert.equal(one.roomName, two.roomName);
  assert.notEqual(one.participantIdentity, two.participantIdentity);
  assert.equal(decoded.sub, `${ctx.session.id}:${A}`);
  assert.equal(decoded.video.room, one.roomName);
  assert.equal(decoded.video.roomJoin, true);
  assert.notEqual(decoded.video.roomAdmin, true);
  assert.equal(
    decoded.exp,
    Math.floor(new Date(one.expiresAt).getTime() / 1000),
  );
  assert.ok(new Date(one.expiresAt) <= new Date(+ctx.clock.now + 120000));
  await assert.rejects(
    () => ctx.sessions.issueLiveKitToken(participant(C), ctx.session.id),
    { message: "SESSION_ACCESS_DENIED" },
  );
  await assert.rejects(
    () => ctx.sessions.issueLiveKitToken(user(A), ctx.session.id),
    { message: "SESSION_ACCESS_DENIED" },
  );
});

test("missing policy blocks token but does not break Session reads", async () => {
  const ctx = await ready();
  const get = ctx.configuration.getSnapshot.bind(ctx.configuration);
  ctx.configuration.getSnapshot = (keys, tx) =>
    keys.includes("livekit.joinWindow")
      ? Promise.reject(
          new ServiceUnavailableException("Configuration not ready"),
        )
      : get(keys, tx);
  await assert.rejects(
    () => ctx.sessions.issueLiveKitToken(participant(A), ctx.session.id),
    { message: "LIVEKIT_POLICY_NOT_READY" },
  );
  const detail = await ctx.sessions.detail(user(A), ctx.session.id);
  assert.equal(detail.join.reason, "LIVEKIT_POLICY_NOT_READY");
  assert.equal(detail.attendanceStatus, "UNAVAILABLE");
  assert.equal("roomMetadata" in detail, false);
  assert.equal("participantToken" in detail, false);
  assert.equal(detail.teacherAttendanceSeconds, "0");
});

test("repeated completion preserves the first note and timestamp", async () => {
  const ctx = await ready();
  ctx.clock.now = new Date(+ctx.session.endAt + 1000);
  await ctx.sessions.complete(user(A), ctx.session.id, "first");
  const first = ctx.db.rows("session")[0].teacherConfirmedAt;
  ctx.clock.now = new Date(+ctx.clock.now + 10000);
  await ctx.sessions.complete(user(A), ctx.session.id, "changed");
  assert.equal(ctx.db.rows("session")[0].teacherConfirmationNote, "first");
  assert.equal(+ctx.db.rows("session")[0].teacherConfirmedAt, +first);
  await ctx.sessions.complete(user(B), ctx.session.id, "learnt");
  await ctx.sessions.complete(user(B), ctx.session.id, "changed again");
  const events = ctx.db
    .rows("outboxEvent")
    .filter((e) => e.type === "learning-path.sessions-completed");
  assert.equal(events.length, 1);
  const detail = await ctx.sessions.detail(user(A), ctx.session.id);
  assert.deepEqual(detail.progress.agreement, { completed: 1, total: 1 });
  assert.deepEqual(detail.progress.plan, { completed: 1, total: 1 });
});

test("progress counts both locked TWO_WAY plans, excluding other plan versions", async () => {
  const ctx = await ready();
  const otherPlan = "ba000000-0000-4000-8000-000000000001";
  ctx.db.seed("pathVersionPlan", {
    pathId: ctx.pathId,
    pathVersion: 1,
    planId: otherPlan,
    planVersion: 1,
  });
  ctx.db.seed("session", {
    ...ctx.session,
    id: "own-second",
    status: "COMPLETED",
  });
  for (let i = 0; i < 3; i++)
    ctx.db.seed("session", {
      ...ctx.session,
      id: `other-${i}`,
      planId: otherPlan,
      status: i === 0 ? "COMPLETED" : "CONFIRMED",
    });
  ctx.db.seed("session", {
    ...ctx.session,
    id: "old-version",
    planVersion: 2,
    status: "COMPLETED",
  });
  const result = await ctx.sessions.detail(user(A), ctx.session.id);
  assert.deepEqual(result.progress, {
    agreement: { completed: 2, total: 5 },
    plan: { completed: 1, total: 2 },
  });
});

test("READY does not shorten the approved 60-minute reschedule cutoff", async () => {
  const ctx = await ready();
  ctx.clock.now = new Date(+ctx.session.startAt - 75 * 60000);
  await ctx.db.session.update({
    where: { id: ctx.session.id },
    data: { status: "READY" },
  });
  await ctx.schedules.proposeReschedule(user(B), ctx.session.id, {
    expectedVersion: 1,
    startAt: "2026-11-04T10:00:00Z",
    endAt: "2026-11-04T11:00:00Z",
  });
  await ctx.schedules.confirmProposal(user(A), ctx.scheduleId, 2);
  await ctx.schedules.confirmProposal(user(B), ctx.scheduleId, 2);
  assert.equal(ctx.db.rows("session")[0].status, "CONFIRMED");
  assert.equal(
    ctx.db.rows("session")[0].startAt.toISOString(),
    "2026-11-04T10:00:00.000Z",
  );
});
