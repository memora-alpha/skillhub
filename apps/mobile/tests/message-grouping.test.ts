import assert from "node:assert/strict";
import test from "node:test";
import { messageGrouping } from "../src/features/messages/utils/message-grouping";

const message = (minute: number, senderId = "a", messageType = "TEXT") => ({
  senderId,
  messageType,
  sentAt: new Date(Date.UTC(2030, 0, 2, 10, minute)).toISOString(),
});
test("consecutive short messages share a timestamp and only the last shows an avatar", () => {
  assert.deepEqual(messageGrouping(message(1), message(0), message(2)), {
    timestamp: null,
    startsGroup: false,
    showAvatar: false,
  });
  assert.equal(messageGrouping(message(2), message(1)).showAvatar, true);
  assert.equal(
    messageGrouping(message(0), undefined, message(1)).timestamp,
    "day",
  );
});
test("changing speaker separates bubbles without repeating the time", () => {
  const result = messageGrouping(
    message(1, "b"),
    message(0, "a"),
    message(2, "a"),
  );
  assert.deepEqual(result, {
    timestamp: null,
    startsGroup: true,
    showAvatar: true,
  });
});
test("15 minutes starts a time marker, shorter gaps do not", () => {
  assert.equal(messageGrouping(message(14), message(0)).timestamp, null);
  assert.equal(messageGrouping(message(15), message(0)).timestamp, "time");
  assert.equal(
    messageGrouping(message(0), undefined, message(15)).showAvatar,
    true,
  );
});
test("local midnight starts a date marker even when the gap is short", () => {
  const before = {
    senderId: "a",
    sentAt: new Date(2030, 0, 2, 23, 59).toISOString(),
  };
  const after = {
    senderId: "a",
    sentAt: new Date(2030, 0, 3, 0, 1).toISOString(),
  };
  assert.equal(messageGrouping(after, before).timestamp, "day");
  assert.equal(messageGrouping(before, undefined, after).showAvatar, true);
});
test("system messages separate avatar groups", () => {
  assert.equal(
    messageGrouping(message(1), message(0, "a", "SYSTEM")).startsGroup,
    true,
  );
  assert.equal(
    messageGrouping(message(1), message(0), message(2, "a", "SYSTEM"))
      .showAvatar,
    true,
  );
});
