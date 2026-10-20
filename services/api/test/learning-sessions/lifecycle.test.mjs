import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID, createHash } from "node:crypto";
import { AccessToken } from "livekit-server-sdk";
import { ConfigService } from "@nestjs/config";
import { LiveKitService } from "../../dist/modules/learning-sessions/infrastructure/livekit/livekit.service.js";
import {
  finalizedOneWay,
  setup,
  user,
  A,
  B,
} from "../learning-platform/fixtures.mjs";

async function activeSession() {
  const ctx = setup({
    wallets: { [B]: 10000n },
    config: { "livekit.joinWindow": { earlyMinutes: 10, lateMinutes: 10 } },
  });
  const ids = await finalizedOneWay(ctx);
  ctx.clock.now = new Date(+ids.session.startAt + 1000);
  await ctx.db.session.update({
    where: { id: ids.session.id },
    data: { roomName: `skillhub-session-${ids.session.id}` },
  });
  const event = {
    id: randomUUID(),
    event: "participant_joined",
    createdAt: BigInt(Math.floor(+ctx.clock.now / 1000)),
    room: { name: `skillhub-session-${ids.session.id}`, sid: "RM_test" },
    participant: { identity: `${ids.session.id}:${A}` },
  };
  return { ...ctx, ...ids, event };
}

test("verified participant observation advances lifecycle, duplicates do not confirm or add duration", async () => {
  const ctx = await activeSession();
  await ctx.sessions.applyLiveKitActivity(ctx.db, ctx.event);
  await ctx.sessions.applyLiveKitActivity(ctx.db, ctx.event);
  const row = ctx.db.rows("session")[0];
  assert.equal(row.status, "ONGOING");
  assert.equal(row.teacherAttendanceSeconds, 0n);
  assert.equal(row.teacherConfirmationStatus, null);
  assert.equal(row.providerRoomId, "RM_test");
  assert.equal(
    (await ctx.sessions.detail(user(B), row.id)).attendanceStatus,
    "UNAVAILABLE",
  );
});

test("small provider clock skew never starts a session before DB startAt", async () => {
  const ctx = await activeSession();
  await ctx.db.session.update({
    where: { id: ctx.session.id },
    data: { startAt: new Date(+ctx.clock.now + 1000) },
  });
  await ctx.sessions.applyLiveKitActivity(ctx.db, {
    ...ctx.event,
    createdAt: ctx.event.createdAt + 2n,
  });
  const row = ctx.db.rows("session")[0];
  assert.equal(row.status, "READY");
  assert.equal(+row.teacherFirstJoinedAt, +ctx.clock.now);
});

test("outsider, stale, future and terminal events never revive or complete sessions", async () => {
  const ctx = await activeSession();
  for (const event of [
    { ...ctx.event, participant: { identity: "outsider" } },
    { ...ctx.event, createdAt: ctx.event.createdAt - 3600n },
    { ...ctx.event, event: "room_finished" },
  ])
    await ctx.sessions.applyLiveKitActivity(ctx.db, event);
  await assert.rejects(
    () =>
      ctx.sessions.applyLiveKitActivity(ctx.db, {
        ...ctx.event,
        createdAt: ctx.event.createdAt + 3600n,
      }),
    { message: "LIVEKIT_EVENT_NOT_YET_CURRENT" },
  );
  assert.equal(ctx.db.rows("session")[0].status, "CONFIRMED");
  for (const status of ["COMPLETED", "CANCELLED", "DISPUTED"]) {
    await ctx.db.session.update({
      where: { id: ctx.session.id },
      data: { status },
    });
    await ctx.sessions.applyLiveKitActivity(ctx.db, ctx.event);
    assert.equal(ctx.db.rows("session")[0].status, status);
  }
});

test("SDK verifies the exact raw webhook bytes before trusting event fields", async () => {
  const key = "test-key",
    secret = "test-secret-for-webhooks";
  const service = new LiveKitService(
    new ConfigService({
      LIVEKIT_URL: "wss://example.livekit.cloud",
      LIVEKIT_API_KEY: key,
      LIVEKIT_API_SECRET: secret,
    }),
  );
  const body = JSON.stringify({
    id: randomUUID(),
    event: "room_started",
    createdAt: Math.floor(Date.now() / 1000),
  });
  const token = new AccessToken(key, secret, { ttl: 120 });
  token.sha256 = createHash("sha256").update(body).digest("base64");
  const auth = await token.toJwt();
  assert.equal((await service.verifyWebhook(body, auth)).event, "room_started");
  await assert.rejects(() => service.verifyWebhook(body + " ", auth), {
    message: "INVALID_LIVEKIT_WEBHOOK",
  });
  await assert.rejects(() => service.verifyWebhook(body, "forged"), {
    message: "INVALID_LIVEKIT_WEBHOOK",
  });
});

test("a delayed snapshot cannot replace a newly bound room incarnation", async () => {
  const ctx = await activeSession();
  const expected = { ...ctx.db.rows("session")[0] };
  await ctx.db.session.update({
    where: { id: ctx.session.id },
    data: { providerRoomId: "RM_new" },
  });
  await ctx.sessions.advanceLifecycle(expected, {
    roomSid: "RM_old",
    identities: [ctx.event.participant.identity],
  });
  assert.equal(ctx.db.rows("session")[0].providerRoomId, "RM_new");
});

test("recreated-room events reconcile the verified current SID, including a quick leave", async () => {
  const ctx = await activeSession();
  await ctx.db.session.update({
    where: { id: ctx.session.id },
    data: { providerRoomId: "RM_old" },
  });
  ctx.sessions.livekit = {
    config: { enabled: true },
    listActiveParticipants: async () => ({
      roomSid: "RM_test",
      identities: [],
    }),
  };
  const event = { ...ctx.event, event: "participant_left" };
  await ctx.sessions.reconcileLiveKitRoom(event);
  await ctx.sessions.applyLiveKitActivity(ctx.db, event);
  assert.equal(ctx.db.rows("session")[0].providerRoomId, "RM_test");
  assert.equal(
    +ctx.db.rows("session")[0].teacherLastLeftAt,
    Number(event.createdAt) * 1000,
  );
});

test("delayed activity from before an overlapping reschedule is ignored", async () => {
  const ctx = await activeSession();
  ctx.configuration.values["livekit.joinWindow"] = {
    earlyMinutes: 90,
    lateMinutes: 10,
  };
  const occurred = new Date(+ctx.clock.now - 60000);
  const history = ctx.db.rows("sessionScheduleHistory")[0];
  await ctx.db.sessionScheduleHistory.update({
    where: { id: history.id },
    data: { appliedAt: ctx.clock.now },
  });
  await ctx.sessions.applyLiveKitActivity(ctx.db, {
    ...ctx.event,
    createdAt: BigInt(Math.floor(+occurred / 1000)),
  });
  assert.equal(ctx.db.rows("session")[0].providerRoomId, null);
});
