import assert from "node:assert/strict";
import test from "node:test";
import {
  chatDayKey,
  chatDayLabel,
  chatTime,
  groupChatDays,
  inboxTime,
} from "../src/features/messages/utils/chat-dates";
import { chatTimeline } from "../src/features/messages/utils/chat-timeline";
import { published, chatId } from "./fixtures/chat-outbox";
import { fixtureId } from "./fixtures/learning-requests-data";
import type { QueuedText } from "../src/features/messages/outbox/outbox-types";

const at = (day: number, hour = 12, minute = 0) =>
  new Date(2026, 9, day, hour, minute).toISOString();
const message = (number: number, day: number, hour = 12, minute = 0) => ({
  ...published(
    { clientMessageId: fixtureId(number), messageText: "Tin nhắn" },
    number,
  ),
  sentAt: at(day, hour, minute),
});

test("same-day history and pending messages share one date header, including older-page merges", () => {
  const pending: QueuedText = {
    clientMessageId: fixtureId(800),
    conversationId: chatId,
    messageText: "Chờ gửi",
    createdAt: at(19, 18),
    state: "queued",
    phase: "send",
    attempts: 0,
    retryAt: 0,
  };
  const rows = groupChatDays(
    chatTimeline(
      [message(1, 18), message(2, 19), message(3, 19, 14)],
      [pending],
    ),
  );
  assert.equal(rows.filter((row) => row.kind === "day").length, 2);
  assert.deepEqual(
    rows.map((row) => row.kind),
    ["day", "message", "day", "message", "message", "queued"],
  );
  const older = groupChatDays(
    chatTimeline([message(4, 17), message(1, 18), message(2, 19)], [pending]),
  );
  assert.deepEqual(
    rows.filter((row) => row.kind === "day").map((row) => row.id),
    older
      .filter((row) => row.kind === "day")
      .slice(1)
      .map((row) => row.id),
  );
});
test("crossing local midnight creates a new group without seconds or repeated dates on messages", () => {
  const rows = groupChatDays(
    chatTimeline([message(1, 18, 23, 59), message(2, 19, 0, 1)], []),
  );
  assert.equal(rows.filter((row) => row.kind === "day").length, 2);
  assert.equal(chatTime(at(19, 0, 1)), "00:01");
  assert.equal(chatTime(at(18, 23, 59)), "23:59");
});
test("older queued text is grouped with its own day even if newer history arrived while offline", () => {
  const pending: QueuedText = {
    clientMessageId: fixtureId(801),
    conversationId: chatId,
    messageText: "Tin hôm qua",
    createdAt: at(18),
    state: "queued",
    phase: "check",
    attempts: 1,
    retryAt: 0,
  };
  const rows = groupChatDays(
    chatTimeline([message(1, 18), message(2, 19)], [pending]),
  );
  assert.deepEqual(
    rows.map((row) => row.kind),
    ["day", "message", "queued", "day", "message"],
  );
  assert.deepEqual(groupChatDays([]), []);
});
test("date headings distinguish today, yesterday, year boundaries and inbox time", () => {
  const now = new Date(2027, 0, 1, 12);
  assert.equal(
    chatDayLabel(new Date(2027, 0, 1).toISOString(), now),
    "Hôm nay · 01/01/2027",
  );
  assert.equal(
    chatDayLabel(new Date(2026, 11, 31).toISOString(), now),
    "Hôm qua · 31/12/2026",
  );
  assert.equal(
    inboxTime(new Date(2026, 11, 31).toISOString(), now),
    "31/12/2026",
  );
  assert.equal(
    inboxTime(new Date(2027, 0, 1, 10, 5).toISOString(), now),
    "10:05",
  );
  assert.equal(chatDayKey(new Date(2027, 0, 1)), "2027-01-01");
});

test("consecutive messages in the same minute show time only on the first, across senders", () => {
  const first = message(1, 19, 12, 5);
  const second = {
    ...message(2, 19, 12, 5),
    senderId: fixtureId(2),
    sentAt: new Date(Date.parse(first.sentAt) + 45000).toISOString(),
  };
  const rows = groupChatDays(
    chatTimeline([first, second, message(3, 19, 12, 6)], []),
  );
  assert.deepEqual(
    rows.filter((row) => row.kind !== "day").map((row) => row.showTime),
    [true, false, true],
  );
});

test("time groups reset at a new day and when a different minute intervenes", () => {
  const rows = groupChatDays(
    chatTimeline(
      [
        message(1, 18, 12, 5),
        message(2, 19, 12, 5),
        message(3, 19, 12, 6),
        message(4, 19, 12, 5),
      ],
      [],
    ),
  );
  assert.deepEqual(
    rows.filter((row) => row.kind !== "day").map((row) => row.showTime),
    [true, true, true, true],
  );
});

test("pending bubbles share the minute group and system notices never consume its first visible time", () => {
  const first = message(1, 19, 12, 5);
  const pending: QueuedText = {
    clientMessageId: fixtureId(800),
    conversationId: chatId,
    messageText: "Đang gửi",
    createdAt: first.sentAt,
    state: "queued",
    phase: "send",
    attempts: 0,
    retryAt: 0,
  };
  const rows = groupChatDays(chatTimeline([first], [pending]));
  assert.deepEqual(
    rows.filter((row) => row.kind !== "day").map((row) => row.showTime),
    [true, false],
  );
  const system = { ...message(2, 19, 12, 5), messageType: "SYSTEM" as const };
  const withNotice = groupChatDays(chatTimeline([first, system], [pending]));
  assert.deepEqual(
    withNotice.filter((row) => row.kind !== "day").map((row) => row.showTime),
    [true, false, true],
  );
});
