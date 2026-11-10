import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { ScheduleConfirmationNotificationHandler } from "../../dist/modules/notifications/infrastructure/events/schedule-confirmation-notification.handler.js";
import { NotificationDispatcher } from "../../dist/modules/notifications/application/services/notification-dispatcher.js";
import { PrismaInAppNotificationAdapter } from "../../dist/modules/notifications/infrastructure/channels/prisma-in-app-notification.adapter.js";
import {
  A,
  B,
  C,
  confirmedTwoWay,
  finalizedOneWay,
  finalizeAs,
  fakeOutboxConsumer,
  scheduledTwoWay,
  setup,
  slots,
  user,
  rejectsWith,
} from "./fixtures.mjs";

const confirmations = (ctx) =>
  ctx.db
    .rows("outboxEvent")
    .filter((e) => e.type === "learning-path.schedule.confirmed");
const chatEvents = (ctx) =>
  ctx.db.rows("outboxEvent").filter((e) => e.type === "chat.system.publish");
const asEvent = (e) => ({
  eventId: e.eventId,
  type: e.type,
  version: e.version,
  payload: e.payload,
  correlationId: e.correlationId,
});
async function proposed(ctx) {
  const { pathId, planBA } = await confirmedTwoWay(ctx);
  const schedule = await ctx.schedules.createProposal(user(B), planBA.id, {
    expectedPlanVersion: 1,
    items: slots(["2026-11-03T10:00:00Z", "2026-11-03T11:00:00Z"]),
  });
  return { pathId, planId: planBA.id, scheduleId: schedule.id };
}

test("each participant/version confirmation snapshots the teaching direction once, without locking the agreement", async () => {
  const ctx = setup();
  const { pathId, planId, scheduleId } = await proposed(ctx);
  for (const [actor, expectedCount, both] of [
    [A, 1, false],
    [A, 1, false],
    [B, 2, true],
    [B, 2, true],
  ]) {
    const result = await ctx.schedules.confirmProposal(
      user(actor),
      scheduleId,
      1,
    );
    assert.equal(result.bothConfirmed, both);
    assert.equal(confirmations(ctx).length, expectedCount);
    assert.equal(chatEvents(ctx).length, expectedCount);
    assert.equal(ctx.db.rows("chatPublication").length, expectedCount);
  }
  const [first, second] = confirmations(ctx).map((e) => e.payload);
  assert.deepEqual(
    [
      first.actorId,
      first.recipientId,
      first.teacherId,
      first.learnerId,
      first.planId,
      first.bothConfirmed,
    ],
    [A, B, B, A, planId, false],
  );
  assert.match(
    first.body,
    /An đã xác nhận lịch Bình dạy An\. Đang chờ Bình xác nhận\./,
  );
  assert.match(
    second.body,
    /Bình đã xác nhận lịch Bình dạy An\. Hai bên đã xác nhận lịch này\. Chờ chốt thỏa thuận\./,
  );
  assert.equal(
    ctx.db.rows("learningPath").find((p) => p.id === pathId).status,
    "CONFIRMED",
  );
  assert.equal(ctx.db.rows("session").length, 0);
  assert.ok(
    chatEvents(ctx).every(
      (e) =>
        e.payload.objectType === "SCHEDULE_PROPOSAL" &&
        e.payload.objectId === scheduleId &&
        e.payload.objectVersion === 1,
    ),
  );
  await rejectsWith(
    ctx.schedules.confirmProposal(user(C), scheduleId, 1),
    403,
    "LEARNING_PATH_ACCESS_DENIED",
  );
  await rejectsWith(
    ctx.schedules.confirmProposal(user(A), scheduleId, 2),
    409,
    "STALE_SCHEDULE_VERSION",
  );
  assert.equal(confirmations(ctx).length, 2);
  await ctx.schedules.reviseProposal(user(B), scheduleId, {
    expectedVersion: 1,
    items: slots(["2026-11-04T10:00:00Z", "2026-11-04T11:00:00Z"]),
  });
  await rejectsWith(
    ctx.schedules.confirmProposal(user(A), scheduleId, 1),
    409,
    "STALE_SCHEDULE_VERSION",
  );
  await ctx.schedules.confirmProposal(user(A), scheduleId, 2);
  assert.equal(confirmations(ctx).length, 3);
  assert.equal(confirmations(ctx).at(-1).payload.scheduleVersion, 2);
  assert.equal(
    confirmations(ctx)[0].payload.body,
    first.body,
    "original content survives later revisions",
  );
});

test("finalize enqueues one lock message and retains the existing lock notification on all replays", async () => {
  const ctx = setup({ wallets: { [A]: 5000n, [B]: 5000n } });
  const { pathId } = await scheduledTwoWay(ctx);
  const before = chatEvents(ctx).length;
  await finalizeAs(ctx, A, pathId);
  await finalizeAs(ctx, A, pathId);
  await finalizeAs(ctx, B, pathId, "different-key");
  assert.equal(chatEvents(ctx).length, before + 1);
  const locked = chatEvents(ctx).filter(
    (e) => e.payload.objectType === "LEARNING_PATH",
  );
  assert.equal(locked.length, 1);
  assert.equal(locked[0].payload.objectId, pathId);
  assert.match(
    locked[0].payload.messageText,
    /Thỏa thuận đã được chốt.*2 buổi học đã được tạo/,
  );
  assert.equal(
    ctx.db.rows("outboxEvent").filter((e) => e.type === "learning-path.locked")
      .length,
    1,
  );
  const count = chatEvents(ctx).length;
  for (const p of ctx.db.rows("scheduleProposal"))
    await ctx.schedules.confirmProposal(user(A), p.id, p.appliedVersion);
  assert.equal(
    chatEvents(ctx).length,
    count,
    "locked confirmation replay produces no chat",
  );
});

test("failed finalization produces no lock message or lock notification", async () => {
  const ctx = setup({ wallets: { [A]: 5000n, [B]: 0n } });
  const { pathId } = await scheduledTwoWay(ctx);
  const before = ctx.db.rows("outboxEvent").length;
  const receipts = ctx.db.rows("chatPublication").length;
  await rejectsWith(
    finalizeAs(ctx, A, pathId),
    409,
    "INSUFFICIENT_AVAILABLE_CREDIT",
  );
  assert.equal(ctx.db.rows("outboxEvent").length, before);
  assert.equal(ctx.db.rows("chatPublication").length, receipts);
});

test("reschedule messages distinguish pending consent, successful apply, and cutoff failure", async () => {
  for (const failCutoff of [false, true]) {
    const ctx = setup({ wallets: { [B]: 10000n } });
    const { scheduleId, session } = await finalizedOneWay(ctx);
    await ctx.schedules.proposeReschedule(user(B), session.id, {
      expectedVersion: 1,
      startAt: "2026-11-04T10:00:00Z",
      endAt: "2026-11-04T11:00:00Z",
    });
    await ctx.schedules.confirmProposal(user(A), scheduleId, 2);
    assert.match(
      confirmations(ctx).at(-1).payload.body,
      /đồng ý đổi lịch.*Lịch hiện tại vẫn giữ nguyên/,
    );
    const count = chatEvents(ctx).length;
    if (failCutoff) {
      ctx.clock.now = new Date("2026-11-02T09:30:00Z");
      await rejectsWith(
        ctx.schedules.confirmProposal(user(B), scheduleId, 2),
        409,
        "RESCHEDULE_CUTOFF_OR_STATE_VIOLATION",
      );
      assert.equal(chatEvents(ctx).length, count);
    } else {
      await ctx.schedules.confirmProposal(user(B), scheduleId, 2);
      assert.equal(chatEvents(ctx).length, count + 1);
      assert.match(
        confirmations(ctx).at(-1).payload.body,
        /Hai bên đã xác nhận đổi lịch\. Lịch mới đã được áp dụng/,
      );
      await ctx.schedules.confirmProposal(user(B), scheduleId, 2);
      assert.equal(chatEvents(ctx).length, count + 1);
    }
  }
});

function delivery(
  ctx,
  { enabled = ["IN_APP", "EMAIL", "PUSH"], failPush = false } = {},
) {
  const sent = { mail: [], push: [] };
  const consumer = fakeOutboxConsumer(ctx.db);
  const control = { failPush };
  const dispatcher = new NotificationDispatcher(
    consumer,
    new PrismaInAppNotificationAdapter(),
    {
      send: async (m) => {
        sent.mail.push(m);
      },
    },
    {
      send: async (m) => {
        if (control.failPush) throw new Error("push unavailable");
        sent.push.push(m);
        return { invalidTokens: [] };
      },
    },
    new Set(enabled),
  );
  const registered = new Map();
  const handler = new ScheduleConfirmationNotificationHandler(
    { register: (type, publisher) => registered.set(type, publisher) },
    dispatcher,
  );
  handler.onModuleInit();
  assert.equal(registered.get("learning-path.schedule.confirmed"), handler);
  return { handler, sent, control };
}

test("confirmation notifies only the other participant, dedupes each channel and retries a failed channel alone", async () => {
  const ctx = setup();
  for (const id of [A, B]) {
    ctx.db.rows("user").find((u) => u.id === id).normalizedEmail =
      `${id}@example.test`;
    ctx.db.seed("pushDeviceToken", { userId: id, token: id });
  }
  const { scheduleId } = await proposed(ctx);
  await ctx.schedules.confirmProposal(user(A), scheduleId, 1);
  const event = asEvent(confirmations(ctx)[0]);
  const { handler, sent, control } = delivery(ctx, { failPush: true });
  await assert.rejects(handler.publish(event), /push unavailable/);
  control.failPush = false;
  // Allow already-started successful channels to finish before retrying delivery.
  await new Promise((resolve) => setImmediate(resolve));
  await handler.publish(event);
  await handler.publish(event);
  assert.deepEqual(
    ctx.db.rows("notification").map((n) => n.userId),
    [B],
  );
  assert.equal(ctx.db.rows("notification")[0].payload.scheduleId, scheduleId);
  assert.equal(sent.mail.length, 1);
  assert.equal(sent.mail[0].to, `${B}@example.test`);
  assert.equal(sent.push.length, 1);
  assert.deepEqual(sent.push[0].tokens, [B]);
  assert.equal(sent.push[0].data.pathId, event.payload.pathId);
  assert.equal(chatEvents(ctx).length, 1);
  await assert.rejects(handler.publish({ ...event, version: 2 }));
  await assert.rejects(
    handler.publish({
      ...event,
      payload: { ...event.payload, recipientId: A },
    }),
  );
});

test("disabled learning notifications suppress all channels while retaining the system chat", async () => {
  const ctx = setup();
  ctx.db.rows("user").find((u) => u.id === B).notificationPreferences = {
    learning: false,
  };
  ctx.db.seed("pushDeviceToken", { userId: B, token: B });
  const { scheduleId } = await proposed(ctx);
  await ctx.schedules.confirmProposal(user(A), scheduleId, 1);
  const { handler, sent } = delivery(ctx);
  await handler.publish(asEvent(confirmations(ctx)[0]));
  assert.equal(ctx.db.rows("notification").length, 0);
  assert.deepEqual(sent, { mail: [], push: [] });
  assert.equal(chatEvents(ctx).length, 1);
  const other = setup();
  const ids = await proposed(other);
  await other.schedules.confirmProposal(user(A), ids.scheduleId, 1);
  const inApp = delivery(other, { enabled: ["IN_APP"] });
  await inApp.handler.publish(asEvent(confirmations(other)[0]));
  assert.equal(other.db.rows("notification").length, 1);
  assert.deepEqual(inApp.sent, { mail: [], push: [] });
});
