import assert from "node:assert/strict";
import { test } from "node:test";
import { AppError } from "../src/lib/http/errors";
import {
  conversationReference,
  readConversationContext,
} from "../src/features/messages/api/conversation-context";
import { fixtureId } from "./fixtures/learning-requests-data";

const conversation = {
  id: fixtureId(40),
  proposalId: fixtureId(70),
  learningRequestId: fixtureId(20),
  participantAId: fixtureId(1),
  participantBId: fixtureId(2),
};
const proposal = {
  id: conversation.proposalId,
  sourceType: "LEARNING_REQUEST",
  learningRequestId: conversation.learningRequestId,
  proposerId: conversation.participantAId,
  recipientId: conversation.participantBId,
  skillId: fixtureId(10),
  conversationId: conversation.id,
};
const request = {
  id: conversation.learningRequestId,
  title: "Làm website đầu tiên với React",
};
const skill = { id: proposal.skillId, name: "React" };

test("request conversation prioritizes its post title and passes cancellation to every read", async () => {
  const reads: string[] = [],
    controller = new AbortController();
  const label = await readConversationContext(
    async (path, options) => {
      reads.push(path);
      assert.equal(options?.signal, controller.signal);
      return path.startsWith("/proposals/") ? proposal : request;
    },
    conversation,
    fixtureId(2),
    controller.signal,
  );
  assert.equal(label, request.title);
  assert.deepEqual(reads, [
    `/proposals/${proposal.id}`,
    `/learning-requests/${request.id}`,
  ]);
});

test("direct conversations use the skill without treating a greeting as a learning goal", async () => {
  const label = await readConversationContext(
    async (path) =>
      path.startsWith("/proposals/")
        ? {
            ...proposal,
            sourceType: "DIRECT_SEARCH",
            learningRequestId: null,
            message: "Xin chào",
          }
        : skill,
    { ...conversation, learningRequestId: null },
    fixtureId(1),
  );
  assert.equal(label, "React · Lời mời trực tiếp");
  assert.notEqual(
    conversationReference(fixtureId(70)),
    conversationReference(fixtureId(71)),
  );
});

test("context rejects mismatched proposal, participants, source and linked resources", async () => {
  for (const changed of [
    { id: fixtureId(71) },
    { proposerId: fixtureId(3) },
    { recipientId: proposal.proposerId },
    { learningRequestId: fixtureId(21) },
    { conversationId: fixtureId(41) },
    { sourceType: "DIRECT_SEARCH" },
  ]) {
    await assert.rejects(
      readConversationContext(
        async () => ({ ...proposal, ...changed }),
        conversation,
        fixtureId(1),
      ),
      (error: unknown) =>
        error instanceof AppError && error.kind === "protocol",
    );
  }
  for (const changed of [fixtureId(21), undefined]) {
    await assert.rejects(
      readConversationContext(
        async (path) =>
          path.startsWith("/proposals/")
            ? proposal
            : { ...request, id: changed },
        conversation,
        fixtureId(1),
      ),
      (error: unknown) =>
        error instanceof AppError && error.kind === "protocol",
    );
  }
  await assert.rejects(
    readConversationContext(async () => proposal, conversation, fixtureId(3)),
  );
});

test("missing or private post falls back to skill/source without using its old title", async () => {
  for (const status of [403, 404]) {
    const label = await readConversationContext(
      async (path) => {
        if (path.startsWith("/proposals/")) return proposal;
        if (path.startsWith("/learning-requests/"))
          throw new AppError("http", status);
        return skill;
      },
      conversation,
      fixtureId(1),
    );
    assert.equal(label, "React · Yêu cầu học");
  }
  assert.equal(
    await readConversationContext(
      async (path) => {
        if (path.startsWith("/proposals/")) return proposal;
        throw new AppError("http", 404);
      },
      conversation,
      fixtureId(1),
    ),
    "Yêu cầu học",
  );
});

test("proposal denial and secondary network/protocol failures are not a successful context", async () => {
  for (const error of [
    new AppError("network"),
    new AppError("protocol"),
    new AppError("http", 500),
  ]) {
    await assert.rejects(
      readConversationContext(
        async (path) => {
          if (path.startsWith("/proposals/")) return proposal;
          throw error;
        },
        conversation,
        fixtureId(1),
      ),
      (caught: unknown) => caught === error,
    );
  }
  let reads = 0;
  await assert.rejects(
    readConversationContext(
      async () => {
        reads++;
        throw new AppError("http", 403);
      },
      conversation,
      fixtureId(1),
    ),
  );
  assert.equal(reads, 1);
  await assert.rejects(
    readConversationContext(
      async (path) =>
        path.startsWith("/proposals/")
          ? {
              ...proposal,
              sourceType: "DIRECT_SEARCH",
              learningRequestId: null,
            }
          : { ...skill, id: fixtureId(11) },
      { ...conversation, learningRequestId: null },
      fixtureId(1),
    ),
  );
});

test("compact chat context uses skill and source while inbox keeps its request title", async () => {
  const reads: string[] = [];
  const label = await readConversationContext(
    async (path) => {
      reads.push(path);
      return path.startsWith("/proposals/") ? proposal : skill;
    },
    conversation,
    conversation.participantAId,
    undefined,
    true,
  );
  assert.equal(label, "React · Yêu cầu học");
  assert.equal(
    reads.some((path) => path.startsWith("/learning-requests/")),
    false,
  );
});
