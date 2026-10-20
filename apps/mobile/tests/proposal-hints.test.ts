import assert from "node:assert/strict";
import test from "node:test";
import {
  apiProposalForm,
  proposalFormValues,
  proposalHints,
} from "../src/features/proposals/schemas/api-proposal-form";
import { createProposalsApi } from "../src/features/proposals/api/proposals-api";
import {
  proposal,
  proposerId,
  recipientId,
  conversation,
} from "./fixtures/proposals-data";

const values = { ...proposalFormValues(), message: proposal.message };

test("all hints are optional; populated form maps to the exact BE fields and types", () => {
  assert.deepEqual(proposalHints(apiProposalForm.parse(values)), {
    message: values.message,
  });
  assert.deepEqual(
    proposalHints(
      apiProposalForm.parse({
        ...values,
        type: "TWO_WAY",
        credit: " 20.00 ",
        sessions: "2",
        duration: "90",
      }),
    ),
    {
      message: values.message,
      exchangeTypeHint: "TWO_WAY",
      proposedCredit: "20.00",
      initialSessionCount: 2,
      proposedDurationMinutes: 90,
    },
  );
});

test("credit requires an exchange type and respects canonical decimals and the TWO_WAY minimum", () => {
  for (const credit of [
    "0",
    "0.00",
    "020",
    "20,00",
    "20.001",
    "1e2",
    "-20",
    "10000000000",
  ])
    assert.equal(
      apiProposalForm.safeParse({ ...values, type: "ONE_WAY", credit }).success,
      false,
      credit,
    );
  assert.equal(
    apiProposalForm.safeParse({ ...values, credit: "20" }).success,
    false,
  );
  assert.equal(
    apiProposalForm.safeParse({ ...values, type: "TWO_WAY", credit: "19.99" })
      .success,
    false,
  );
  for (const credit of ["0.01", "9999999999.99"])
    assert.equal(
      apiProposalForm.safeParse({ ...values, type: "ONE_WAY", credit }).success,
      true,
    );
});

test("duration and session count enforce DTO integer bounds without inventing server policy", () => {
  for (const duration of ["59", "181", "60.5", "1e2", "abc"])
    assert.equal(
      apiProposalForm.safeParse({ ...values, duration }).success,
      false,
      duration,
    );
  for (const sessions of ["0", "-1", "1.5", "32768", "abc"])
    assert.equal(
      apiProposalForm.safeParse({ ...values, sessions }).success,
      false,
      sessions,
    );
  assert.equal(
    apiProposalForm.safeParse({ ...values, duration: "180", sessions: "32767" })
      .success,
    true,
  );
});

test("schedule guidance is optional NFC text with no timestamp interpretation or five-slot cap", () => {
  const input = "  Tối thứ 5 và thứ 7\nCuối tuần  ";
  const result = proposalHints(
    apiProposalForm.parse({ ...values, candidateSlots: input }),
  );
  assert.equal(result.candidateSlots, input.normalize("NFC").trim());
  assert.equal(
    apiProposalForm.safeParse({
      ...values,
      candidateSlots: "Hôm qua, sau đó bàn tiếp",
    }).success,
    true,
  );
  assert.equal(
    apiProposalForm.safeParse({ ...values, candidateSlots: "r".repeat(2000) })
      .success,
    true,
  );
  for (const candidateSlots of [
    [],
    {},
    [{ startAt: "2030-01-01", endAt: "2030-01-02" }],
  ])
    assert.equal(
      apiProposalForm.safeParse({ ...values, candidateSlots }).success,
      false,
    );
});

test("edit preserves hidden details and unchanged schedule text; explicit clearing sends null", async () => {
  const saved = {
    ...proposal,
    exchangeTypeHint: "ONE_WAY" as const,
    proposedCredit: "50.00",
    initialSessionCount: 2,
    proposedDurationMinutes: 90,
    candidateSlots: "Tối thứ 5 và thứ 7",
  };
  const baseline = apiProposalForm.parse(proposalFormValues(saved));
  assert.deepEqual(
    proposalHints({ ...baseline, message: "Chỉ cập nhật lời nhắn." }, saved),
    { message: "Chỉ cập nhật lời nhắn." },
  );
  const cleared = proposalHints(
    apiProposalForm.parse({
      ...baseline,
      type: "",
      credit: "",
      sessions: "",
      duration: "",
      candidateSlots: "  ",
    }),
    saved,
  );
  assert.deepEqual(cleared, {
    message: saved.message,
    exchangeTypeHint: null,
    proposedCredit: null,
    initialSessionCount: null,
    proposedDurationMinutes: null,
    candidateSlots: null,
  });
  const calls: unknown[] = [];
  await createProposalsApi(async (_path, options) => {
    calls.push(options?.body);
    return { ...proposal, version: 2 };
  }, proposerId).update(
    saved.id,
    { ...cleared, expectedVersion: 1 },
    "clear-key",
  );
  assert.deepEqual(calls, [{ ...cleared, expectedVersion: 1 }]);
});

test("legacy timestamp JSON migrated to text remains an unchanged string on edit", () => {
  const legacy =
    '[{"startAt":"2020-01-01T12:00:00Z","endAt":"2020-01-01T13:00:00Z"}]';
  const saved = { ...proposal, candidateSlots: legacy };
  assert.equal(proposalFormValues(saved).candidateSlots, legacy);
  assert.equal(
    Object.hasOwn(
      proposalHints(apiProposalForm.parse(proposalFormValues(saved)), saved),
      "candidateSlots",
    ),
    false,
  );
});

test("schedule text retries keep the original request and key; old array responses are rejected", async () => {
  const body = {
    message: proposal.message,
    sourceType: "LEARNING_REQUEST" as const,
    learningRequestId: proposal.learningRequestId!,
    candidateSlots: "Tối thứ 5 và thứ 7",
  };
  const calls: unknown[] = [];
  const api = createProposalsApi(async (_path, options) => {
    calls.push(options);
    return { ...proposal, ...body };
  }, proposerId);
  await api.create(body, "original-intent");
  await api.create(body, "original-intent");
  assert.deepEqual(calls[0], calls[1]);
  const oldServer = createProposalsApi(
    async () => ({ ...proposal, candidateSlots: [] }),
    proposerId,
  );
  await assert.rejects(oldServer.detail(proposal.id));
});
test("accept sends expectedRequestVersion only when accepting a displayed request snapshot", async () => {
  const calls: unknown[] = [];
  const api = createProposalsApi(async (_path, options) => {
    calls.push(options?.body);
    return {
      proposal: { ...proposal, status: "ACCEPTED", version: 2 },
      conversation,
    };
  }, recipientId);
  await api.decide(proposal.id, "accept", 1, "accept", 7);
  assert.deepEqual(calls, [{ expectedVersion: 1, expectedRequestVersion: 7 }]);
  await assert.rejects(api.decide(proposal.id, "reject", 1, "reject", 7));
  await assert.rejects(api.decide(proposal.id, "accept", 1, "accept", 0));
  assert.equal(calls.length, 1);
});
