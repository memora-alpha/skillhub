import assert from "node:assert/strict";
import test from "node:test";
import type { RequestOptions } from "../src/lib/http/client";
import { AppError } from "../src/lib/http/errors";
import {
  createProposalsApi,
  type Proposal,
} from "../src/features/proposals/api/proposals-api";
import {
  apiProposalForm,
  proposalHints,
} from "../src/features/proposals/schemas/api-proposal-form";
import { fixtureId } from "./fixtures/learning-requests-data";

const proposal: Proposal = {
  id: fixtureId(101),
  sourceType: "LEARNING_REQUEST",
  learningRequestId: fixtureId(201),
  proposerId: fixtureId(1),
  recipientId: fixtureId(2),
  skillId: fixtureId(301),
  message: "Cùng thực hành React qua một dự án nhỏ.",
  exchangeTypeHint: "ONE_WAY",
  proposedCredit: "50",
  proposedDurationMinutes: 60,
  initialSessionCount: 4,
  candidateSlots: "Cuối tuần",
  status: "PENDING",
  version: 1,
  expiresAt: "2030-01-02T00:00:00Z",
  createdAt: "2030-01-01T00:00:00Z",
  updatedAt: "2030-01-01T00:00:00Z",
};
function adapter(userId = proposal.proposerId) {
  let response: unknown = proposal;
  let failure: AppError | undefined;
  const calls: { path: string; options?: RequestOptions }[] = [];
  const api = createProposalsApi((path, options) => {
    calls.push({ path, options });
    return failure ? Promise.reject(failure) : Promise.resolve(response);
  }, userId);
  return {
    api,
    calls,
    respond(value: unknown) {
      response = value;
    },
    fail(error: AppError) {
      failure = error;
    },
  };
}
function acceptance() {
  return {
    proposal: { ...proposal, status: "ACCEPTED", version: 2 },
    conversation: {
      id: fixtureId(401),
      proposalId: proposal.id,
      learningRequestId: proposal.learningRequestId,
      participantAId: proposal.proposerId,
      participantBId: proposal.recipientId,
      createdAt: proposal.createdAt,
    },
  };
}

test("proposal edit normalizes form hints and sends version/idempotency without changing identity", async () => {
  const h = adapter();
  const values = apiProposalForm.parse({
    message: "  Nội dung đã cập nhật cho đề xuất.  ",
    type: "ONE_WAY",
    credit: "45.50",
    duration: "90",
    sessions: "6",
    candidateSlots: " Tối Thứ 7 ",
  });
  const hints = proposalHints(values, proposal);
  h.respond({ ...proposal, ...hints, version: 2 });
  const saved = await h.api.update(
    proposal.id,
    { ...hints, expectedVersion: 1 },
    "edit-intent",
  );
  assert.equal(saved.id, proposal.id);
  assert.equal(saved.proposerId, proposal.proposerId);
  assert.equal(saved.learningRequestId, proposal.learningRequestId);
  assert.equal(saved.message, values.message.trim());
  assert.equal(saved.candidateSlots, "Tối Thứ 7");
  assert.equal(saved.initialSessionCount, 6);
  assert.equal(proposal.proposedCredit, "50");
  assert.deepEqual(h.calls[0], {
    path: "/proposals/" + proposal.id,
    options: {
      method: "PATCH",
      body: { ...hints, expectedVersion: 1 },
      idempotencyKey: "edit-intent",
    },
  });
});

test("proposal update rejects responses for another resource, the wrong actor or an unchanged version", async () => {
  const h = adapter();
  for (const invalid of [
    { ...proposal, id: fixtureId(999), version: 2 },
    {
      ...proposal,
      proposerId: proposal.recipientId,
      recipientId: proposal.proposerId,
      version: 2,
    },
    proposal,
  ]) {
    h.respond(invalid);
    await assert.rejects(
      h.api.update(
        proposal.id,
        { message: proposal.message, expectedVersion: 1 },
        "edit-intent",
      ),
      AppError,
    );
  }
});

test("withdraw/reject outcomes must belong to the matching sender or receiver", async () => {
  const sender = adapter();
  const receiver = adapter(proposal.recipientId);
  sender.respond({ ...proposal, status: "WITHDRAWN", version: 2 });
  assert.equal(
    (await sender.api.decide(proposal.id, "withdraw", 1, "withdraw-intent"))
      .proposal.status,
    "WITHDRAWN",
  );
  receiver.respond({ ...proposal, status: "REJECTED", version: 2 });
  assert.equal(
    (await receiver.api.decide(proposal.id, "reject", 1, "reject-intent"))
      .proposal.status,
    "REJECTED",
  );
  assert.deepEqual(receiver.calls[0]?.options?.body, { expectedVersion: 1 });
  sender.respond({ ...proposal, status: "REJECTED", version: 2 });
  receiver.respond({ ...proposal, status: "WITHDRAWN", version: 2 });
  await assert.rejects(
    sender.api.decide(proposal.id, "reject", 1, "invalid-reject"),
    AppError,
  );
  await assert.rejects(
    receiver.api.decide(proposal.id, "withdraw", 1, "invalid-withdraw"),
    AppError,
  );
});

test("accept forwards both versions and validates the server conversation outcome", async () => {
  const h = adapter(proposal.recipientId);
  const accepted = acceptance();
  h.respond(accepted);
  const saved = await h.api.decide(
    proposal.id,
    "accept",
    1,
    "accept-intent",
    3,
  );
  assert.equal(saved.conversation?.id, accepted.conversation.id);
  assert.equal(saved.proposal.status, "ACCEPTED");
  assert.deepEqual(h.calls[0]?.options, {
    method: "POST",
    body: { expectedVersion: 1, expectedRequestVersion: 3 },
    idempotencyKey: "accept-intent",
  });
});

test("accept rejects a conversation for another proposal, request or participant", async () => {
  const h = adapter(proposal.recipientId);
  const accepted = acceptance();
  for (const changed of [
    { proposalId: fixtureId(999) },
    { learningRequestId: fixtureId(999) },
    { participantAId: fixtureId(999) },
  ]) {
    h.respond({
      ...accepted,
      conversation: { ...accepted.conversation, ...changed },
    });
    await assert.rejects(
      h.api.decide(proposal.id, "accept", 1, "accept-intent", 3),
      AppError,
    );
  }
});

test("a server version conflict propagates without replay or a locally synthesized outcome", async () => {
  const h = adapter();
  const conflict = new AppError("http", 409);
  h.fail(conflict);
  await assert.rejects(
    h.api.update(
      proposal.id,
      { message: proposal.message, expectedVersion: 1 },
      "edit-intent",
    ),
    (error) => error === conflict,
  );
  assert.equal(h.calls.length, 1);
  assert.equal(proposal.status, "PENDING");
});

test("API proposal form enforces decimal precision, session bounds and message validation", () => {
  const valid = {
    message: proposal.message,
    type: "ONE_WAY",
    credit: "45.50",
    sessions: "6",
    candidateSlots: "Tối Thứ 7",
  };
  assert.equal(apiProposalForm.safeParse(valid).success, true);
  for (const credit of ["0", "-1", "Infinity", "1.234", "10000000000", "1e2"])
    assert.equal(
      apiProposalForm.safeParse({ ...valid, credit }).success,
      false,
      credit,
    );
  for (const sessions of ["0", "-1", "1.5", "32768", "9007199254740992"])
    assert.equal(
      apiProposalForm.safeParse({ ...valid, sessions }).success,
      false,
      sessions,
    );
  for (const message of [
    "short",
    "a".repeat(1001),
    "Nội dung có ký tự" + String.fromCodePoint(1),
  ])
    assert.equal(
      apiProposalForm.safeParse({ ...valid, message }).success,
      false,
    );
});
