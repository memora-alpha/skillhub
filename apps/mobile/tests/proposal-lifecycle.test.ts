import assert from "node:assert/strict";
import test from "node:test";
import { AppError } from "../src/lib/http/errors";
import {
  createProposalsApi,
  type ProposalInput,
  type ProposalHints,
} from "../src/features/proposals/api/proposals-api";
import {
  proposal,
  conversation,
  proposerId,
  recipientId,
} from "./fixtures/proposals-data";
import { fixtureId } from "./fixtures/learning-requests-data";
test("proposal edit sends only message/version; old server hints remain in its response", async () => {
  const calls: unknown[] = [];
  const updated = {
    ...proposal,
    message: "Nội dung đề xuất đã cập nhật.",
    version: 2,
    proposedCredit: "50.00",
    initialSessionCount: 4,
  };
  const api = createProposalsApi(async (path, options) => {
    calls.push({ path, options });
    return updated;
  }, proposerId);
  const result = await api.update(
    proposal.id,
    { message: updated.message, expectedVersion: 1 },
    "edit-key",
  );
  assert.deepEqual(calls, [
    {
      path: `/proposals/${proposal.id}`,
      options: {
        method: "PATCH",
        body: { message: updated.message, expectedVersion: 1 },
        idempotencyKey: "edit-key",
      },
    },
  ]);
  assert.equal(result.proposedCredit, "50.00");
  assert.equal(result.initialSessionCount, 4);
  assert.equal(proposal.version, 1);
});
test("strict create/edit input rejects FE-only fields, invalid hints and mixed source identifiers before HTTP", async () => {
  let calls = 0;
  const api = createProposalsApi(async () => {
    calls++;
    return proposal;
  }, proposerId);
  const source = {
    message: proposal.message,
    sourceType: "LEARNING_REQUEST",
    learningRequestId: proposal.learningRequestId!,
  };
  for (const extra of [
    { credit: "50" },
    { sessions: 4 },
    { schedule: "Cuối tuần" },
    { note: "Lý do" },
    { recipientId },
    { proposedCredit: "50.00" },
    { initialSessionCount: 0 },
    { initialSessionCount: 32768 },
    { proposedDurationMinutes: 59 },
    { recipientSharingSkillId: fixtureId(300) },
  ])
    await assert.rejects(
      api.create({ ...source, ...extra } as ProposalInput, "create-key"),
      AppError,
    );
  for (const extra of [
    { note: "Lý do" },
    { credit: "50" },
    { learningRequestId: fixtureId(200) },
    { candidateSlots: [{ startAt: "later", endAt: "later" }] },
  ])
    await assert.rejects(
      api.update(
        proposal.id,
        {
          message: proposal.message,
          expectedVersion: 1,
          ...extra,
        } as ProposalHints & { expectedVersion: number },
        "edit-key",
      ),
      AppError,
    );
  assert.equal(calls, 0);
});
for (const action of ["reject", "withdraw"] as const) {
  test(`${action} sends only expectedVersion and accepts the matching party/status`, async () => {
    const calls: unknown[] = [],
      actor = action === "reject" ? recipientId : proposerId;
    const row = {
      ...proposal,
      status: action === "reject" ? "REJECTED" : "WITHDRAWN",
      version: 2,
      localDecisionNote: "must not be displayed",
    };
    const api = createProposalsApi(async (path, options) => {
      calls.push({ path, options });
      return row;
    }, actor);
    const result = await api.decide(proposal.id, action, 1, "decision-key");
    assert.deepEqual(calls, [
      {
        path: `/proposals/${proposal.id}/${action}`,
        options: {
          method: "POST",
          body: { expectedVersion: 1 },
          idempotencyKey: "decision-key",
        },
      },
    ]);
    assert.equal(result.proposal.status, row.status);
    assert.equal("localDecisionNote" in result.proposal, false);
    assert.equal(result.conversation, undefined);
    await assert.rejects(
      createProposalsApi(
        async () => row,
        action === "reject" ? proposerId : recipientId,
      ).decide(proposal.id, action, 1, "bad-role"),
      AppError,
    );
  });
}
test("accept returns the BE conversation identity and rejects wrong parties or nonadvancing versions", async () => {
  const result = {
    proposal: { ...proposal, status: "ACCEPTED", version: 2 },
    conversation,
  };
  const api = createProposalsApi(async () => result, recipientId);
  assert.equal(
    (await api.decide(proposal.id, "accept", 1, "accept-key")).conversation?.id,
    conversation.id,
  );
  await assert.rejects(
    createProposalsApi(async () => result, proposerId).decide(
      proposal.id,
      "accept",
      1,
      "wrong-role",
    ),
    AppError,
  );
  await assert.rejects(
    createProposalsApi(
      async () => ({ ...result, proposal: { ...result.proposal, version: 1 } }),
      recipientId,
    ).decide(proposal.id, "accept", 1, "old-version"),
    AppError,
  );
  await assert.rejects(
    api.decide(proposal.id, "accept", 0, "invalid-version"),
    AppError,
  );
  await assert.rejects(
    createProposalsApi(async () => proposal, proposerId).update(
      proposal.id,
      { message: proposal.message, expectedVersion: 1 },
      "unchanged-version",
    ),
    AppError,
  );
});
test("request-owner proposal list sends the BE filter and rejects mismatched request results", async () => {
  const calls: string[] = [];
  const page = {
    data: [proposal],
    meta: { pagination: { limit: 20, hasMore: false, nextCursor: null } },
  };
  const api = createProposalsApi(async (path) => {
    calls.push(path);
    return page;
  }, recipientId);
  assert.equal(
    (
      await api.list(
        "received",
        "PENDING",
        undefined,
        undefined,
        proposal.learningRequestId!,
      )
    ).items.length,
    1,
  );
  assert.equal(
    new URL(calls[0]!, "https://fixture.test").searchParams.get(
      "learningRequestId",
    ),
    proposal.learningRequestId,
  );
  await assert.rejects(
    api.list("received", undefined, undefined, undefined, fixtureId(201)),
    AppError,
  );
  const before = calls.length;
  await assert.rejects(
    api.list(
      "sent",
      undefined,
      undefined,
      undefined,
      proposal.learningRequestId!,
    ),
    AppError,
  );
  assert.equal(calls.length, before);
});
