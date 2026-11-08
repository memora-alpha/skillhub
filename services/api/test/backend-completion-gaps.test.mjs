import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import {
  listInput,
  listBoundary,
  listResult,
} from "../dist/shared/http/list-page.js";
import {
  notificationGroup,
  notificationPreferences,
  preferredRecipients,
} from "../dist/modules/notifications/domain/notification-preferences.js";
import { NotificationPreferencesService } from "../dist/modules/notifications/application/services/notification-preferences.service.js";
import { NotificationDispatcher } from "../dist/modules/notifications/application/services/notification-dispatcher.js";
import { ConnectionNotificationService } from "../dist/modules/notifications/application/services/connection-notification.service.js";
import { feeTimestamp } from "../dist/modules/credit/application/services/fee-policy-admin.service.js";

test("fee scheduling and report timestamps require an explicit timezone", () => {
  assert.equal(
    feeTimestamp("2026-11-09T17:00:00+07:00").toISOString(),
    "2026-11-09T10:00:00.000Z",
  );
  assert.throws(
    () => feeTimestamp("2026-11-09T17:00:00"),
    /INVALID_FEE_TIMESTAMP/,
  );
});
import { LearningChangeState } from "../dist/modules/learning-paths/application/services/learning-change-state.js";
import { PathTerminationService } from "../dist/modules/learning-paths/application/services/path-termination.service.js";
import { SessionChangesService } from "../dist/modules/learning-sessions/application/services/session-changes.service.js";
import { AuditWriter } from "../dist/modules/audit/application/services/audit-writer.js";
import { AuditRepository } from "../dist/modules/audit/infrastructure/persistence/audit.repository.js";
import {
  setup,
  completedOneWay,
  finalizedOneWay,
  user,
  A,
  B,
} from "./learning-platform/fixtures.mjs";
import { runner } from "./learning-platform/fake-db.mjs";

test("pagination rejects legacy/foreign cursors and preserves a time/UUID boundary and anchor", () => {
  const at = new Date("2026-11-09T10:00:00Z"),
    ids = [randomUUID(), randomUUID(), randomUUID()];
  const page = listResult(
    ids.map((id) => ({ id })),
    2,
    "viewer:filter",
    () => at,
    at,
  );
  assert.equal(page.pagination.hasMore, true);
  const { cursor } = listInput(
    { cursor: page.pagination.nextCursor },
    "viewer:filter",
  );
  assert.equal(cursor.anchor, at.toISOString());
  assert.deepEqual(listBoundary("startAt", cursor, true), {
    AND: [
      { OR: [{ startAt: { gt: at } }, { startAt: at, id: { gt: ids[1] } }] },
    ],
  });
  assert.throws(
    () => listInput({ cursor: page.pagination.nextCursor }, "another-viewer"),
    /INVALID_CURSOR/,
  );
  assert.throws(() => listInput({ limit: 101 }, "scope"), /INVALID_PAGE_LIMIT/);
  assert.throws(
    () =>
      listInput(
        {
          cursor: Buffer.from(
            JSON.stringify({ id: ids[0], scope: "scope", value: ids[0] }),
          ).toString("base64url"),
        },
        "scope",
      ),
    /INVALID_CURSOR/,
  );
});

function termination(ctx) {
  const state = new LearningChangeState(
    new AuditWriter(new AuditRepository()),
    ctx.configuration,
  );
  return new PathTerminationService(
    runner(ctx.db),
    state,
    new SessionChangesService(runner(ctx.db), state),
    {},
    ctx.requests,
    ctx.requestPaths,
  );
}
test("fully completed Paths reject new termination but old request replay and normal settlement survive", async () => {
  const ctx = setup({ wallets: { [B]: 10000n } }),
    ids = await completedOneWay(ctx);
  await assert.rejects(
    termination(ctx).request(
      user(A),
      ids.pathId,
      "completed-new",
      "Completed agreement",
    ),
    /PATH_ALREADY_LEARNING_FINISHED/,
  );
  assert.equal(ctx.db.rows("learningChangeRequest").length, 0);
  ctx.clock.now = new Date("2026-11-05T00:00:00Z");
  await ctx.sessions.settlePath(user(B), ids.pathId);
  assert.ok(ctx.db.rows("learningPath")[0].settledAt);

  const earlier = setup({ wallets: { [B]: 10000n } }),
    scheduled = await finalizedOneWay(earlier),
    service = termination(earlier);
  const request = await service.request(
    user(A),
    scheduled.pathId,
    "existing",
    "Previously requested",
  );
  await earlier.db.session.update({
    where: { id: scheduled.session.id },
    data: { status: "COMPLETED" },
  });
  assert.equal(
    (
      await service.request(
        user(A),
        scheduled.pathId,
        "existing",
        "Previously requested",
      )
    ).id,
    request.id,
  );
  await assert.rejects(
    service.request(
      user(A),
      scheduled.pathId,
      "another",
      "New request after completion",
    ),
    /PATH_ALREADY_LEARNING_FINISHED/,
  );
  await assert.rejects(
    service.request(
      user(A),
      scheduled.pathId,
      "existing",
      "Changed request body",
    ),
    /CHANGE_REQUEST_KEY_CONFLICT/,
  );
});

test("sessions continue beyond 100 with a pinned implicit-now range and viewer-bound cursor", async () => {
  const ctx = setup({ wallets: { [B]: 10000n } }),
    ids = await finalizedOneWay(ctx);
  for (let i = 0; i < 125; i++)
    ctx.db.seed("session", { ...ids.session, id: randomUUID() });
  const first = await ctx.sessions.mine(user(A), undefined, undefined, {
    limit: 100,
  });
  assert.equal(first.data.length, 100);
  const boundary = listInput(
    { cursor: first.pagination.nextCursor },
    JSON.stringify(["sessions-mine-v1", A, null, null]),
  ).cursor;
  ctx.clock.now = new Date(+ids.session.endAt + 86400000);
  const second = await ctx.sessions.mine(user(A), undefined, undefined, {
    limit: 100,
    cursor: first.pagination.nextCursor,
  });
  assert.equal(second.data.length, 26);
  assert.equal(second.pagination.hasMore, false);
  assert.equal(
    new Set([...first.data, ...second.data].map((row) => row.id)).size,
    126,
  );
  assert.ok(boundary.anchor);
  await assert.rejects(
    ctx.sessions.mine(user(B), undefined, undefined, {
      cursor: first.pagination.nextCursor,
    }),
    /INVALID_CURSOR/,
  );
});

test("preferences default on and suppress delivery per group across inbox/email/push and direct chat", async () => {
  assert.deepEqual(notificationPreferences(null), {
    learning: true,
    credit: true,
    community: true,
  });
  assert.equal(notificationGroup("material.refunded"), "credit");
  assert.equal(notificationGroup("skill.verification.decided"), "community");
  assert.equal(notificationGroup("auth.password.reset"), null);
  const sent = [],
    tx = {
      user: {
        findMany: async ({ where, select }) => {
          if (select.notificationPreferences)
            return [
              { id: A, notificationPreferences: { learning: false } },
              { id: B, notificationPreferences: null },
            ];
          assert.deepEqual(where.id.in, [B]);
          return [{ id: B, normalizedEmail: "recipient@example.invalid" }];
        },
      },
      notification: {
        create: async ({ data }) => {
          sent.push(data.userId);
          return data;
        },
      },
      pushDeviceToken: {
        findMany: async ({ where }) => {
          assert.deepEqual(where.userId.in, [B]);
          return [{ token: "recipient-device" }];
        },
      },
    };
  assert.deepEqual(await preferredRecipients(tx, [A, B], "session.updated"), [
    B,
  ]);
  const dispatcher = new NotificationDispatcher(
    { processOnce: async (_consumer, _id, work) => work(tx) },
    { notify: async (_tx, message) => sent.push(...message.userIds) },
    {
      send: async (mail) => {
        assert.equal(mail.to, "recipient@example.invalid");
      },
    },
    {
      send: async (push) => {
        assert.deepEqual(push.tokens, ["recipient-device"]);
        return { invalidTokens: [] };
      },
    },
    new Set(["IN_APP", "EMAIL", "PUSH"]),
  );
  await dispatcher.dispatch({
    eventId: randomUUID(),
    type: "learning-path.locked",
    userIds: [A, B],
  });
  assert.deepEqual(sent, [B]);
  const direct = new ConnectionNotificationService();
  assert.equal(
    await direct.createChat(tx, {
      notificationId: randomUUID(),
      userId: A,
      conversationId: randomUUID(),
      messageId: randomUUID(),
    }),
    null,
  );
  assert.deepEqual(sent, [B]);
});

test("preference PATCH preserves omitted fields, rejects null and revalidates after locking", async () => {
  let value = { learning: false, credit: true, community: false },
    checks = 0;
  const tx = {
    $queryRaw: async () => [],
    user: {
      findUniqueOrThrow: async () => ({ notificationPreferences: value }),
      update: async ({ data }) => {
        value = data.notificationPreferences;
      },
    },
  };
  const service = new NotificationPreferencesService(
    { run: async (work) => work(tx) },
    {
      assertLive: async () => {
        checks++;
        return { userId: A };
      },
    },
  );
  assert.deepEqual(await service.update({ userId: A }, { credit: false }), {
    learning: false,
    credit: false,
    community: false,
  });
  assert.equal(checks, 2);
  assert.throws(
    () => service.update({ userId: A }, { learning: null }),
    /INVALID_NOTIFICATION_PREFERENCES/,
  );
  assert.throws(
    () => service.update({ userId: A }, { unknown: true }),
    /INVALID_NOTIFICATION_PREFERENCES/,
  );
});
