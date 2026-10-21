import assert from "node:assert/strict";
import { test } from "node:test";
import { hasUnreadIncoming } from "../src/features/messages/utils/inbox-unread";
import { createChatEventHydrator } from "../src/features/messages/utils/event-hydration";
import { fixtureId } from "./fixtures/learning-requests-data";

const viewer = fixtureId(1),
  partner = fixtureId(2);
const readAt = "2030-01-01T00:00:00Z";

test("incoming messages without the viewer's read receipt highlight the conversation", () => {
  assert.equal(
    hasUnreadIncoming([{ senderId: partner, readAt: null }], viewer),
    true,
  );
  assert.equal(
    hasUnreadIncoming([{ senderId: partner, readAt }], viewer),
    false,
  );
});

test("a peer not reading our outgoing message is not an incoming unread message", () => {
  assert.equal(
    hasUnreadIncoming([{ senderId: viewer, readAt: null }], viewer),
    false,
  );
  assert.equal(
    hasUnreadIncoming([{ senderId: viewer, readAt }], viewer),
    false,
  );
});

test("an unread incoming message still counts as evidence when the newest message is outgoing", () => {
  assert.equal(
    hasUnreadIncoming(
      [
        { senderId: partner, readAt: null },
        { senderId: viewer, readAt: null },
      ],
      viewer,
    ),
    true,
  );
  assert.equal(
    hasUnreadIncoming(
      [
        { senderId: partner, readAt },
        { senderId: viewer, readAt: null },
      ],
      viewer,
    ),
    false,
  );
});

test("empty history or an unavailable viewer never invents an unread signal", () => {
  assert.equal(hasUnreadIncoming([], viewer), false);
  assert.equal(
    hasUnreadIncoming([{ senderId: partner, readAt: null }], undefined),
    false,
  );
});

const frame = {
  event: "chat.read.updated",
  id: fixtureId(90),
  data: JSON.stringify({
    eventId: fixtureId(90),
    version: 1,
    data: {
      conversationId: fixtureId(40),
      readerId: viewer,
      lastReadSequence: "3",
    },
  }),
};
test("read-update events reload both thread receipts and the matching inbox preview", async () => {
  const reloaded: unknown[] = [];
  const hydrator = createChatEventHydrator({
    reload: async (prefixes, receiptsFor) => {
      reloaded.push({ prefixes, receiptsFor });
    },
    assertCurrent: () => {},
    renew: async () => {},
    ready: () => {},
  });
  await hydrator.handle(frame, new AbortController().signal);
  assert.deepEqual(reloaded, [
    {
      prefixes: [
        ["thread", fixtureId(40)],
        ["conversations", "preview", fixtureId(40)],
      ],
      receiptsFor: fixtureId(40),
    },
  ]);
  assert.equal(hydrator.cursor, frame.id);
});

test("failed preview hydration does not acknowledge a read event and can retry it", async () => {
  let fail = true,
    reloads = 0;
  const hydrator = createChatEventHydrator({
    reload: async () => {
      reloads++;
      if (fail) throw new Error("read failed");
    },
    assertCurrent: () => {},
    renew: async () => {},
    ready: () => {},
  });
  await assert.rejects(hydrator.handle(frame, new AbortController().signal));
  assert.equal(hydrator.cursor, undefined);
  fail = false;
  await hydrator.handle(frame, new AbortController().signal);
  assert.equal(reloads, 2);
  assert.equal(hydrator.cursor, frame.id);
});
