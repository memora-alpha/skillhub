import assert from "node:assert/strict";
import { test } from "node:test";
import type { ApiMessage } from "../src/features/messages/api/messages-api";
import type { QueuedText } from "../src/features/messages/outbox/outbox-types";
import { chatTimeline } from "../src/features/messages/utils/chat-timeline";
import { chatSendNotice } from "../src/features/messages/utils/chat-send-notice";
import { fixtureId } from "./fixtures/learning-requests-data";

const at = (minute: number) =>
  new Date(Date.UTC(2026, 10, 21, 8, minute)).toISOString();
const message = (n: number, minute = n): ApiMessage => ({
  id: fixtureId(n),
  conversationId: fixtureId(40),
  senderId: fixtureId(1),
  messageText: "Tin thử nghiệm",
  messageType: "TEXT",
  attachments: [],
  sequence: String(n),
  sentAt: at(minute),
  readAt: null,
});
const queued = (
  n: number,
  minute: number,
  state: QueuedText["state"] = "failed",
): QueuedText => ({
  clientMessageId: fixtureId(n),
  conversationId: fixtureId(40),
  messageText: "Nội dung thử nghiệm bị chặn",
  createdAt: at(minute),
  state,
  phase: "check",
  attempts: 1,
  retryAt: 0,
  ...(state === "failed" ? { failureCode: "CONTENT_MODERATION_BLOCKED" } : {}),
});

test("fresh revoked availability wins over an older local delivery receipt", () => {
  const attachment = {
    attachmentId: fixtureId(60),
    fileId: fixtureId(50),
    filename: "lesson.pdf",
    mimeType: "application/pdf",
    fileSizeBytes: 100,
    downloadUrlEndpoint: "/fixture",
    availability: "AVAILABLE" as const,
  };
  const receipt = { ...message(2), attachments: [attachment] };
  const refreshed = {
    ...receipt,
    attachments: [{ ...attachment, availability: "REVOKED" as const }],
  };
  const result = chatTimeline(
    [refreshed],
    [{ ...queued(80, 1, "sent"), messageId: receipt.id, message: receipt }],
  );
  assert.equal(result[0]?.kind, "message");
  if (result[0]?.kind === "message")
    assert.equal(result[0].message.attachments[0]?.availability, "REVOKED");
});

test("old failed messages cannot push a newly delivered message above them when reconciliation removes its local copy", () => {
  const old = message(1, 0);
  const failed = queued(80, 1);
  const sending = queued(81, 2, "sending");
  const delivered = message(2, 3);
  const keys = new Map<string, string>();
  const before = chatTimeline([old], [failed, sending], keys);
  const after = chatTimeline(
    [old, delivered],
    [
      failed,
      {
        ...sending,
        state: "sent",
        messageId: delivered.id,
        message: delivered,
      },
    ],
    keys,
  );
  const reconciled = chatTimeline([old, delivered], [failed], keys);
  assert.deepEqual(
    before.map((row) => row.id),
    [old.id, failed.clientMessageId, sending.clientMessageId],
  );
  assert.deepEqual(
    after.map((row) => row.id),
    before.map((row) => row.id),
  );
  assert.deepEqual(
    reconciled.map((row) => row.id),
    before.map((row) => row.id),
  );
  assert.equal(reconciled.at(-1)?.kind, "message");
  assert.equal(
    after.filter(
      (row) => row.kind === "message" && row.message.id === delivered.id,
    ).length,
    1,
  );
});

test("multiple rejected attempts remain between the surrounding published messages after a history refresh", () => {
  const first = message(1, 0),
    second = message(2, 4),
    third = message(3, 7);
  const failed = [queued(80, 2), queued(81, 2), queued(82, 5)];
  const timeline = chatTimeline([first, second, third], failed);
  assert.deepEqual(
    timeline.map((row) => row.id),
    [
      first.id,
      failed[0]!.clientMessageId,
      failed[1]!.clientMessageId,
      second.id,
      failed[2]!.clientMessageId,
      third.id,
    ],
  );
  for (const row of timeline) {
    if (row.kind === "queued")
      assert.equal(
        chatSendNotice(row.entry, false)?.title,
        "Không gửi được tin nhắn",
      );
  }
});

test("server sequence remains canonical despite non-monotonic timestamps, while pending sends stay newest despite clock skew", () => {
  const messages = [message(1, 3), message(2, 2), message(3, 5)];
  const failed = queued(80, 4),
    pending = queued(81, 1, "queued");
  const timeline = chatTimeline(messages, [failed, pending]);
  assert.deepEqual(
    timeline
      .filter((row) => row.kind === "message")
      .map((row) => row.message.sequence),
    ["1", "2", "3"],
  );
  assert.equal(timeline.at(-1)?.id, pending.clientMessageId);
  assert.equal(
    timeline.findIndex((row) => row.id === failed.clientMessageId),
    2,
  );
});
