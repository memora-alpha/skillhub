import assert from "node:assert/strict";
import test from "node:test";
import {
  inboxGroups,
  requestMessageRoute,
  chatInboxRoute,
  inboxCount,
} from "../src/features/messages/utils/inbox-groups";
import type { InboxConversation } from "../src/features/messages/utils/conversation-preview";
import type { Proposal } from "../src/features/proposals/api/proposals-api";
import { fixtureId } from "./fixtures/learning-requests-data";

const viewer = fixtureId(1),
  request = fixtureId(20),
  otherRequest = fixtureId(21);
function conversation(
  id: number,
  requestId: string | null,
  partner = fixtureId(2),
): InboxConversation {
  return {
    conversation: {
      id: fixtureId(id),
      proposalId: fixtureId(id + 100),
      learningRequestId: requestId,
      participantAId: viewer,
      participantBId: partner,
      createdAt: "2030-01-01T00:00:00Z",
    },
    preview: `Chat ${id}`,
    activityAt: "2030-01-01T00:00:00Z",
  };
}
function proposal(
  id: number,
  requestId: string | null,
  status: Proposal["status"] = "PENDING",
): Proposal {
  return {
    id: fixtureId(id),
    sourceType: requestId ? "LEARNING_REQUEST" : "DIRECT_SEARCH",
    learningRequestId: requestId,
    proposerId: fixtureId(2),
    recipientId: viewer,
    skillId: fixtureId(30),
    message: "Proposal message",
    exchangeTypeHint: null,
    proposedCredit: null,
    proposedDurationMinutes: null,
    initialSessionCount: null,
    candidateSlots: null,
    status,
    version: 1,
    createdAt: "2030-01-01T00:00:00Z",
    updatedAt: "2030-01-01T00:00:00Z",
    expiresAt: "2030-02-01T00:00:00Z",
  };
}

test("groups different participants by request UUID, keeping the same partner in different requests separate", () => {
  const input = [
    conversation(40, request),
    conversation(41, request, fixtureId(3)),
    conversation(42, otherRequest),
  ];
  const before = JSON.stringify(input);
  const groups = inboxGroups(input, [proposal(70, request)], viewer);
  assert.equal(groups.length, 2);
  assert.deepEqual(
    groups.map((g) => g.id),
    [request, otherRequest],
  );
  const first = groups[0];
  assert.ok(first?.kind === "request");
  assert.equal(first.hasPending, true);
  assert.equal(first.hasChat, true);
  assert.equal(first.chatCount, 2);
  assert.equal(first.receivedCount, 1);
  assert.equal(JSON.stringify(input), before);
});

test("rejected-only request remains discoverable while direct conversations keep their identity", () => {
  const direct = conversation(40, null);
  const groups = inboxGroups(
    [direct],
    [proposal(70, request, "REJECTED"), proposal(71, null, "REJECTED")],
    viewer,
  );
  const group = groups.find((g) => g.id === request);
  assert.ok(group?.kind === "request");
  assert.equal(group.hasPending, false);
  assert.equal(group.hasChat, false);
  assert.equal(group.receivedCount, 1);
  assert.equal(group.preview, "Đề xuất đã từ chối");
  assert.equal(
    groups.find((g) => g.kind === "direct")?.id,
    direct.conversation.id,
  );
});

test("sorts groups by latest activity while retaining unread evidence and outbox failure from separate conversations", () => {
  const older = { ...conversation(40, request), unread: true };
  const failed = {
    ...conversation(41, request, fixtureId(3)),
    state: "failed" as const,
    preview: "Bạn: Draft",
    activityAt: "2030-01-05T00:00:00Z",
  };
  const groups = inboxGroups(
    [older, failed, conversation(42, otherRequest)],
    [],
    viewer,
  );
  const first = groups[0];
  assert.ok(first?.kind === "request");
  assert.equal(first.id, request);
  assert.equal(first.unread, true);
  assert.equal(first.preview, "Chưa gửi · Bạn: Draft");
});

test("does not include proposals or conversations belonging to another viewer", () => {
  const foreign = conversation(40, request);
  foreign.conversation.participantAId = fixtureId(4);
  const sent = {
    ...proposal(70, request),
    proposerId: viewer,
    recipientId: fixtureId(2),
  };
  assert.deepEqual(inboxGroups([foreign], [sent], viewer), []);
});

test("request screen validates route inputs and defaults to pending without trusting route titles or owners", () => {
  assert.deepEqual(
    requestMessageRoute({ id: request, title: "Spoofed", ownerId: viewer }),
    { id: request, view: "received", status: "PENDING" },
  );
  assert.deepEqual(
    requestMessageRoute({ id: request, view: "chats", status: "REJECTED" }),
    { id: request, view: "chats", status: "REJECTED" },
  );
  for (const value of [
    {},
    { id: [request] },
    { id: "fake" },
    { id: request, view: "bad" },
    { id: request, status: "bad" },
  ])
    assert.equal(requestMessageRoute(value), null);
});

test("chat Back uses the actual conversation request and directs direct-search chats to the inbox", () => {
  assert.deepEqual(chatInboxRoute({ learningRequestId: request }), {
    pathname: "/messages/request/[id]",
    params: { id: request, view: "chats" },
  });
  assert.equal(chatInboxRoute({ learningRequestId: null }), "/messages");
});

test("counts all received proposal statuses and unique chat IDs without replacing the latest message with a newer proposal event", () => {
  const history = [
    "PENDING",
    "ACCEPTED",
    "REJECTED",
    "WITHDRAWN",
    "EXPIRED",
  ].map((status, n) => proposal(70 + n, request, status as Proposal["status"]));
  history[0]!.updatedAt = "2030-01-06T00:00:00Z";
  const earlier = conversation(40, request);
  const latest = {
    ...conversation(41, request, fixtureId(3)),
    activityAt: "2030-01-05T00:00:00Z",
  };
  const group = inboxGroups(
    [earlier, latest, latest],
    [...history, history[0]!],
    viewer,
  )[0];
  assert.ok(group?.kind === "request");
  assert.equal(group.receivedCount, 5);
  assert.equal(group.pendingCount, 1);
  assert.equal(group.chatCount, 2);
  assert.equal(group.preview, latest.preview);
  assert.equal(
    group.latestConversation?.conversation.id,
    latest.conversation.id,
  );
  assert.equal(group.activityAt, "2030-01-06T00:00:00Z");
});

test("partial pages report lower bounds rather than exact totals or a false zero", () => {
  const group = inboxGroups(
    [conversation(40, request)],
    [proposal(70, request)],
    viewer,
    { received: false, chats: false },
  )[0];
  assert.ok(group?.kind === "request");
  assert.equal(inboxCount(group.receivedCount, group.receivedCountExact), "1+");
  assert.equal(inboxCount(group.chatCount, group.chatCountExact), "1+");
  assert.equal(inboxCount(0, false), "…");
  assert.equal(inboxCount(0, true), "0");
});
