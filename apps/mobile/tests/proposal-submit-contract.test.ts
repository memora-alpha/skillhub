import assert from "node:assert/strict";
import test from "node:test";
import axios, { type InternalAxiosRequestConfig } from "axios";
import { createHttpClient } from "../src/lib/http/client";
import { AppError } from "../src/lib/http/errors";
import {
  createProposalsApi,
  type ProposalInput,
} from "../src/features/proposals/api/proposals-api";
import {
  apiProposalForm,
  proposalHints,
} from "../src/features/proposals/schemas/api-proposal-form";
import { fixtureId } from "./fixtures/learning-requests-data";

const me = fixtureId(1),
  other = fixtureId(2),
  requestId = fixtureId(200);
const sharingSkillId = fixtureId(300);
const values = {
  message: "Tôi có thể dạy bạn",
  type: "ONE_WAY" as const,
  credit: "20.00",
  duration: "60",
  sessions: "1",
};
const sources = [
  { sourceType: "LEARNING_REQUEST" as const, learningRequestId: requestId },
  {
    sourceType: "DIRECT_SEARCH" as const,
    recipientSharingSkillId: sharingSkillId,
  },
];

function savedProposal(body: ProposalInput) {
  const timestamp = "2026-10-18T00:00:00.000Z";
  return {
    ...body,
    id: fixtureId(500),
    learningRequestId:
      body.sourceType === "LEARNING_REQUEST" ? requestId : null,
    proposerId: me,
    recipientId: other,
    skillId: fixtureId(10),
    exchangeTypeHint: body.exchangeTypeHint ?? null,
    proposedCredit: body.proposedCredit ?? null,
    proposedDurationMinutes: body.proposedDurationMinutes ?? null,
    initialSessionCount: body.initialSessionCount ?? null,
    candidateSlots: body.candidateSlots ?? null,
    status: "PENDING",
    version: 1,
    expiresAt: "2026-11-01T00:00:00.000Z",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function transport(
  reply: (index: number) => { status: number; data: unknown },
) {
  const calls: InternalAxiosRequestConfig[] = [];
  let token = "fixture-token",
    renewals = 0;
  const http = axios.create({
    adapter: async (config) => {
      calls.push(config);
      return { ...reply(calls.length), config, statusText: "", headers: {} };
    },
  });
  const client = createHttpClient(() => "https://fixture.test/api/v1", http);
  client.bindSession({
    generation: 1,
    getToken: async () => token,
    renew: async () => {
      token = "renewed-fixture-token";
      renewals++;
    },
    expire: async () => {},
  });
  return {
    api: createProposalsApi(
      (path, options) =>
        client.request(path, { ...options, authenticated: true }),
      me,
    ),
    calls,
    get renewals() {
      return renewals;
    },
  };
}

for (const source of sources) {
  for (const status of [201, 200]) {
    test(`${source.sourceType}: POST sends typed optional hints and source; accepts HTTP ${status}`, async () => {
      const body = {
        ...proposalHints(apiProposalForm.parse(values)),
        ...source,
      };
      const h = transport(() => ({
        status,
        data: { success: true, message: "ok", data: savedProposal(body) },
      }));
      const result = await h.api.create(body, "proposal-intent");
      assert.equal(result.id, fixtureId(500));
      assert.equal(result.proposedCredit, "20.00");
      assert.equal(result.initialSessionCount, 1);
      assert.equal(h.calls.length, 1);
      const call = h.calls[0]!;
      assert.equal(call.baseURL, "https://fixture.test/api/v1");
      assert.equal(call.url, "/proposals");
      assert.equal(call.method, "post");
      assert.equal(call.headers.get("Authorization"), "Bearer fixture-token");
      assert.equal(call.headers.get("Idempotency-Key"), "proposal-intent");
      assert.equal(call.headers.get("Content-Type"), "application/json");
      assert.deepEqual(JSON.parse(call.data), {
        ...source,
        message: values.message,
        exchangeTypeHint: "ONE_WAY",
        proposedCredit: "20.00",
        proposedDurationMinutes: 60,
        initialSessionCount: 1,
      });
    });
  }

  test(`${source.sourceType}: token renewal preserves the exact payload and idempotency key`, async () => {
    const body = { ...proposalHints(apiProposalForm.parse(values)), ...source };
    const h = transport((index) =>
      index === 1
        ? { status: 401, data: { success: false, message: "INVALID_TOKEN" } }
        : {
            status: 200,
            data: { success: true, message: "ok", data: savedProposal(body) },
          },
    );
    await h.api.create(body, "same-proposal-intent");
    assert.equal(h.renewals, 1);
    assert.equal(h.calls.length, 2);
    assert.equal(h.calls[0]!.data, h.calls[1]!.data);
    assert.equal(
      h.calls[1]!.headers.get("Authorization"),
      "Bearer renewed-fixture-token",
    );
    for (const call of h.calls)
      assert.equal(call.headers.get("Idempotency-Key"), "same-proposal-intent");
  });
}

test("blank optional values never add null hints or candidate slots to the create payload", async () => {
  const body = {
    ...proposalHints(
      apiProposalForm.parse({
        ...values,
        type: "",
        credit: "",
        duration: "",
        sessions: "",
      }),
    ),
    ...sources[0]!,
  };
  const h = transport(() => ({
    status: 201,
    data: { success: true, message: "ok", data: savedProposal(body) },
  }));
  await h.api.create(body, "optional-hints-intent");
  assert.deepEqual(JSON.parse(h.calls[0]!.data), {
    ...sources[0],
    message: values.message,
  });
});

test("proposal submission keeps backend eligibility errors as a rejection", async () => {
  const h = transport(() => ({
    status: 409,
    data: {
      success: false,
      message: "TEACHER_SKILL_NOT_ELIGIBLE",
      statusCode: 409,
    },
  }));
  await assert.rejects(
    h.api.create(
      { ...proposalHints(apiProposalForm.parse(values)), ...sources[0]! },
      "ineligible-intent",
    ),
    (error: unknown) =>
      error instanceof AppError &&
      error.status === 409 &&
      error.code === "TEACHER_SKILL_NOT_ELIGIBLE",
  );
  assert.equal(h.calls.length, 1);
});
