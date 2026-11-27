import assert from "node:assert/strict";
import test from "node:test";
import { createChatEventHydrator } from "../src/features/messages/utils/event-hydration";
import { fixtureId } from "./fixtures/learning-requests-data";

const signal = new AbortController().signal;
const ready = { event: "stream.ready", id: "head", data: "{}" };
const message = {
  event: "chat.message.created",
  id: "new-message",
  data: JSON.stringify({
    version: 1,
    eventId: fixtureId(99),
    data: {
      conversationId: fixtureId(1),
      messageId: fixtureId(2),
      messageSequence: "3",
    },
  }),
};

test("resume refreshes attachments without a full reload and still replays affected resources", async () => {
  const reloads: unknown[] = [],
    received: string[] = [];
  let readyCount = 0,
    fail = false;
  const hydration = createChatEventHydrator({
    reload: async (prefixes) => {
      reloads.push(prefixes);
      if (fail) throw Error("offline");
    },
    assertCurrent: () => {},
    renew: async () => {},
    ready: () => {
      readyCount++;
    },
    receive: async (frame) => {
      received.push(frame.event);
    },
  });
  await hydration.handle(ready, signal);
  await hydration.handle(ready, signal);
  assert.equal(reloads.length, 2);
  assert.deepEqual(reloads[1], [["chat-file"], ["thread"]]);
  assert.equal(readyCount, 2);
  assert.deepEqual(received, ["stream.ready", "stream.ready"]);
  fail = true;
  await assert.rejects(hydration.handle(message, signal));
  assert.equal(hydration.cursor, "head");
  fail = false;
  await hydration.handle(message, signal);
  assert.equal(hydration.cursor, "new-message");
  assert.deepEqual(reloads.at(-1), [
    ["thread", fixtureId(1)],
    ["conversations", "preview", fixtureId(1)],
    ["conversations", "inbox"],
  ]);
  await hydration.handle(
    { event: "stream.checkpoint", data: "{}", id: "checkpoint" },
    signal,
  );
  assert.equal(reloads.length, 4);
});

test("availability events hydrate the conversation and older attachments; malformed references are not acknowledged", async () => {
  const calls: unknown[] = [];
  const hydration = createChatEventHydrator({
    reload: async (...args) => {
      calls.push(args);
    },
    assertCurrent() {},
    renew: async () => {},
    ready() {},
  });
  const frame = {
    event: "chat.attachment.availability.updated",
    id: "availability-1",
    data: JSON.stringify({
      version: 1,
      eventId: fixtureId(90),
      data: {
        conversationId: fixtureId(1),
        messageId: fixtureId(2),
        fileId: fixtureId(3),
      },
    }),
  };
  await hydration.handle(frame, signal);
  assert.deepEqual(calls, [
    [
      [
        ["thread", fixtureId(1)],
        ["conversations", "preview", fixtureId(1)],
        ["chat-file", fixtureId(1), fixtureId(3)],
      ],
      undefined,
      fixtureId(1),
    ],
  ]);
  await hydration.handle(frame, signal);
  assert.equal(calls.length, 1);
  await assert.rejects(
    hydration.handle(
      {
        ...frame,
        id: "bad",
        data: JSON.stringify({
          version: 1,
          eventId: fixtureId(91),
          data: { conversationId: fixtureId(1), fileId: fixtureId(3) },
        }),
      },
      signal,
    ),
    { kind: "protocol" },
  );
  assert.equal(hydration.cursor, "availability-1");
});

test("reset and cursor rejection require full recovery again; aborted recovery cannot mark ready", async () => {
  let reloads = 0,
    readyCount = 0;
  const control = new AbortController();
  let abort = false;
  const hydration = createChatEventHydrator({
    reload: async () => {
      reloads++;
      if (abort) control.abort();
    },
    assertCurrent: () => {},
    renew: async () => {},
    ready: () => {
      readyCount++;
    },
  });
  await hydration.handle(ready, signal);
  await assert.rejects(
    hydration.handle({ event: "stream.reset-required", data: "{}" }, signal),
  );
  assert.equal(hydration.cursor, undefined);
  abort = true;
  await hydration.handle(ready, control.signal);
  assert.equal(readyCount, 1);
  assert.equal(hydration.cursor, undefined);
  abort = false;
  await hydration.handle(ready, signal);
  assert.equal(reloads, 3);
  assert.equal(readyCount, 2);
  hydration.reset(); // A rejected Last-Event-ID (HTTP 400/409) takes the same path.
  await hydration.handle(ready, signal);
  assert.equal(reloads, 4);
});
