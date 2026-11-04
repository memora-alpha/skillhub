import assert from "node:assert/strict";
import test from "node:test";
import {
  orderConversations,
  orderInboxGroups,
} from "../src/features/messages/utils/inbox-order";
import type { ApiInboxGroup } from "../src/features/messages/api/messages-api";
import { createChatEventHydrator } from "../src/features/messages/utils/event-hydration";
import { fixtureId } from "./fixtures/learning-requests-data";

const conversations = [1, 2].map((n) => ({
  id: fixtureId(n),
  proposalId: fixtureId(40 + n),
  learningRequestId: null,
  participantAId: fixtureId(10),
  participantBId: fixtureId(11),
  createdAt: `2030-01-0${n}T00:00:00Z`,
}));
test("new message activity moves a conversation to the top without changing API data", () => {
  const activity = new Map<string, string>();
  const order = () =>
    orderConversations(conversations, (id) => activity.get(id)).map(
      (item) => item.id,
    );
  assert.deepEqual(order(), [fixtureId(2), fixtureId(1)]);
  activity.set(fixtureId(1), "2030-01-03T00:00:00Z");
  assert.deepEqual(order(), [fixtureId(1), fixtureId(2)]);
  activity.set(fixtureId(2), "2030-01-04T00:00:00Z");
  assert.deepEqual(order(), [fixtureId(2), fixtureId(1)]);
  assert.equal(conversations[0]!.id, fixtureId(1));
  assert.deepEqual(
    orderConversations(conversations, () => "invalid"),
    [...conversations].reverse(),
  );
});
test("equal message timestamps retain stable list order", () => {
  assert.deepEqual(
    orderConversations(conversations, () => "2030-02-01T00:00:00Z"),
    conversations,
  );
});

test("a newer chat promotes its request above other groups while stale preview data cannot demote it", () => {
  const groups: ApiInboxGroup[] = [2, 1].map((n) => ({
    id: `request:${fixtureId(n)}`,
    groupType: "LEARNING_REQUEST",
    learningRequestId: fixtureId(n),
    conversationId: null,
    title: null,
    viewerRole: "OWNER",
    receivedProposalCount: 1,
    sentProposalCount: 0,
    conversationCount: 1,
    lastActivityAt: `2030-01-0${n}T00:00:00Z`,
  }));
  assert.deepEqual(
    orderInboxGroups(groups, () => undefined),
    groups,
  );
  assert.deepEqual(
    orderInboxGroups(groups, () => "2029-01-01T00:00:00Z"),
    groups,
  );
  assert.deepEqual(
    orderInboxGroups(groups, (group) =>
      group.learningRequestId === fixtureId(1)
        ? "2030-01-03T00:00:00Z"
        : undefined,
    ),
    [...groups].reverse(),
  );
});
test("message events refresh the affected thread, preview and grouped inbox", async () => {
  const reloads: unknown[] = [];
  const hydrator = createChatEventHydrator({
    reload: async (prefixes) => {
      reloads.push(prefixes);
    },
    assertCurrent: () => {},
    renew: async () => {},
    ready: () => {},
  });
  await hydrator.handle(
    {
      event: "chat.message.created",
      id: fixtureId(90),
      data: JSON.stringify({
        eventId: fixtureId(90),
        version: 1,
        data: {
          conversationId: fixtureId(1),
          messageId: fixtureId(80),
          messageSequence: "3",
        },
      }),
    },
    new AbortController().signal,
  );
  assert.deepEqual(reloads, [
    [
      ["thread", fixtureId(1)],
      ["conversations", "preview", fixtureId(1)],
      ["conversations", "inbox"],
    ],
  ]);
});
