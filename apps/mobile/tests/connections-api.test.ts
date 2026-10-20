import assert from "node:assert/strict";
import test from "node:test";
import { AppError } from "../src/lib/http/errors";
import { parsePage } from "../src/lib/http/contracts";
import { CommandIntent } from "../src/lib/http/command-intent";
import { ReadAccess } from "../src/lib/http/read-access";
import {
  createProposalsApi,
  proposalSchema,
} from "../src/features/proposals/api/proposals-api";
import {
  apiProposalForm,
  proposalHints,
} from "../src/features/proposals/schemas/api-proposal-form";
import {
  createMessagesApi,
  mergeMessages,
  type ApiMessage,
} from "../src/features/messages/api/messages-api";
import {
  validateChatFile,
  chatFileFormData,
  CHAT_MAX_BYTES,
} from "../src/features/messages/utils/chat-file";
import { createSseParser } from "../src/features/messages/utils/sse-parser";
import {
  negotiationMessage,
  negotiationSchema,
} from "../src/features/learning-paths/negotiation";
import { fixtureId } from "./fixtures/learning-requests-data";

const me = fixtureId(1),
  other = fixtureId(2),
  proposalId = fixtureId(500),
  conversationId = fixtureId(600);
const proposal = {
  id: proposalId,
  sourceType: "LEARNING_REQUEST",
  learningRequestId: fixtureId(200),
  proposerId: me,
  recipientId: other,
  skillId: fixtureId(10),
  message: "Tôi có thể hướng dẫn React thực hành.",
  exchangeTypeHint: "ONE_WAY",
  proposedCredit: "50.00",
  proposedDurationMinutes: 90,
  initialSessionCount: 2,
  candidateSlots: null,
  status: "PENDING",
  version: 3,
  expiresAt: "2026-11-01T00:00:00.000Z",
  createdAt: "2026-10-14T00:00:00.000Z",
  updatedAt: "2026-10-14T00:00:00.000Z",
};
const conversation = {
  id: conversationId,
  proposalId,
  learningRequestId: proposal.learningRequestId,
  participantAId: me,
  participantBId: other,
  createdAt: proposal.createdAt,
};
const message = (n: number, seq = String(n)): ApiMessage => ({
  id: fixtureId(700 + n),
  conversationId,
  senderId: me,
  messageText: "Trao đổi về mục tiêu học.",
  messageType: "TEXT",
  attachments: [],
  sequence: seq,
  sentAt: proposal.createdAt,
  readAt: null,
});
const page = (data: unknown[]) => ({
  data,
  meta: { pagination: { limit: 20, hasMore: false, nextCursor: null } },
});

test("proposal create uses the source contract and stable idempotency key without preview fields", async () => {
  const calls: unknown[] = [];
  const api = createProposalsApi(async (path, options) => {
    calls.push({ path, options });
    return { ...proposal, email: "private@example.test" };
  }, me);
  const body = {
    sourceType: "LEARNING_REQUEST" as const,
    learningRequestId: proposal.learningRequestId,
    message: proposal.message,
  };
  const result = await api.create(body, "stable-command-id");
  assert.deepEqual(calls, [
    {
      path: "/proposals",
      options: { method: "POST", body, idempotencyKey: "stable-command-id" },
    },
  ]);
  assert.ok(!("email" in result));
  await assert.rejects(
    api.create(
      { ...body, learningRequestId: "preview-request" },
      "another-command",
    ),
    AppError,
  );
  assert.equal(calls.length, 1);
});
test("proposal pages enforce viewer, direction, filter, pagination and resource identity", async () => {
  const valid = createProposalsApi(async () => page([proposal]), me);
  assert.equal((await valid.list("sent", "PENDING")).items[0]?.id, proposalId);
  await assert.rejects(valid.list("received"), AppError);
  await assert.rejects(valid.list("sent", "ACCEPTED"), AppError);
  await assert.rejects(
    createProposalsApi(async () => proposal, fixtureId(9)).detail(proposalId),
    AppError,
  );
  await assert.rejects(valid.detail(fixtureId(999)), AppError);
  assert.throws(
    () =>
      parsePage(proposalSchema, {
        ...page([]),
        meta: { pagination: { limit: 100, hasMore: true, nextCursor: null } },
      }),
    AppError,
  );
});
test("proposal decisions carry exact version and acceptance verifies its conversation", async () => {
  const calls: unknown[] = [];
  const result = {
    proposal: { ...proposal, status: "ACCEPTED", version: 4 },
    conversation,
  };
  const api = createProposalsApi(async (path, options) => {
    calls.push({ path, options });
    return result;
  }, other);
  const accepted = await api.decide(proposalId, "accept", 3, "accept-identity");
  assert.equal(accepted.conversation?.id, conversationId);
  assert.deepEqual(calls[0], {
    path: `/proposals/${proposalId}/accept`,
    options: {
      method: "POST",
      body: { expectedVersion: 3 },
      idempotencyKey: "accept-identity",
    },
  });
  await assert.rejects(
    createProposalsApi(
      async () => ({
        ...result,
        conversation: { ...conversation, proposalId: fixtureId(501) },
      }),
      other,
    ).decide(proposalId, "accept", 3, "key"),
    AppError,
  );
  await assert.rejects(
    createProposalsApi(
      async () => ({
        ...result,
        conversation: { ...conversation, participantBId: fixtureId(9) },
      }),
      other,
    ).decide(proposalId, "accept", 3, "key"),
    AppError,
  );
});
test("proposal form omits empty hints and rejects invalid supplied hints", () => {
  const base = {
    message: proposal.message,
    type: "" as const,
    credit: "",
    sessions: "",
    duration: "",
  };
  assert.deepEqual(proposalHints(apiProposalForm.parse(base)), {
    message: proposal.message,
  });
  for (const changed of [
    { credit: "20" },
    { type: "TWO_WAY", credit: "19.99" },
    { duration: "59" },
    { duration: "181" },
    { sessions: "32768" },
    { credit: "1e3", type: "ONE_WAY" },
  ])
    assert.equal(
      apiProposalForm.safeParse({ ...base, ...changed }).success,
      false,
    );
  assert.equal(apiProposalForm.safeParse({ message: "Ngắn" }).success, false);
});
test("unknown command outcomes retain identity and block changed intent until reconciled", () => {
  const intent = new CommandIntent();
  let count = 0;
  const next = () => `id-${++count}`;
  assert.equal(intent.begin("body-v1", next), "id-1");
  for (const error of [
    new AppError("network"),
    new AppError("protocol"),
    new AppError("http", 503),
  ]) {
    intent.failed(error);
    assert.equal(intent.begin("body-v1", next), "id-1");
    assert.throws(
      () => intent.begin("body-v2", next),
      (e: unknown) =>
        e instanceof AppError && e.code === "COMMAND_RECONCILE_REQUIRED",
    );
  }
  intent.failed(new AppError("http", 409));
  assert.equal(intent.begin("body-v2", next), "id-2");
  intent.clear();
  assert.equal(intent.begin("body-v3", next), "id-3");
});
test("read denial stays hidden through a later outage and late reads cannot restore access", async () => {
  const access = new ReadAccess();
  await access.read(
    async () => proposal,
    () => true,
  );
  await assert.rejects(
    access.read(
      async () => {
        throw new AppError("http", 403);
      },
      () => true,
    ),
  );
  assert.equal(access.denied, true);
  await assert.rejects(
    access.read(
      async () => {
        throw new AppError("http", 503);
      },
      () => true,
    ),
  );
  assert.equal(access.denied, true);
  await access.read(
    async () => proposal,
    () => true,
  );
  assert.equal(access.denied, false);
  await assert.rejects(
    access.read(
      async () => proposal,
      () => false,
    ),
    AppError,
  );
});
test("chat send separates published delivery from 202 receipts and uses clientMessageId only", async () => {
  const calls: unknown[] = [];
  const clientMessageId = fixtureId(800);
  const receipt = {
    deliveryStatus: "PENDING",
    messageId: fixtureId(701),
    clientMessageId,
    statusUrl: `/api/v1/conversations/${conversationId}/message-deliveries/${clientMessageId}`,
    failureCode: null,
  };
  const api = createMessagesApi(async (path, options) => {
    calls.push({ path, options });
    return receipt;
  }, me);
  const body = {
    clientMessageId,
    messageText: "Nội dung trao đổi",
    attachmentFileIds: [],
  };
  assert.equal(
    (await api.send(conversationId, body)).deliveryStatus,
    "PENDING",
  );
  assert.deepEqual(calls[0], {
    path: `/conversations/${conversationId}/messages`,
    options: { method: "POST", body },
  });
  await api.delivery(conversationId, clientMessageId);
  assert.equal(
    (calls[1] as { path: string }).path,
    `/conversations/${conversationId}/message-deliveries/${clientMessageId}`,
  );
  const delivered = createMessagesApi(
    async () => ({ deliveryStatus: "DELIVERED", message: message(1) }),
    me,
  );
  assert.equal(
    (await delivered.send(conversationId, body)).deliveryStatus,
    "DELIVERED",
  );
  await assert.rejects(
    createMessagesApi(
      async () => ({ ...receipt, clientMessageId: fixtureId(801) }),
      me,
    ).send(conversationId, body),
    AppError,
  );
  await assert.rejects(
    createMessagesApi(
      async () => ({
        deliveryStatus: "DELIVERED",
        message: { ...message(1), senderId: other },
      }),
      me,
    ).send(conversationId, body),
    AppError,
  );
});
test("history and membership reject cross-conversation results; forward recovery preserves BIGINT sequences", async () => {
  const api = createMessagesApi(
    async () => page([message(1, "9007199254740993")]),
    me,
  );
  assert.equal(
    (await api.history(conversationId, { afterSequence: "9007199254740992" }))
      .items.length,
    1,
  );
  await assert.rejects(
    api.history(conversationId, { afterSequence: "9007199254740993" }),
    AppError,
  );
  await assert.rejects(
    api.history(conversationId, { cursor: "old", afterSequence: "1" }),
    AppError,
  );
  await assert.rejects(
    createMessagesApi(
      async () => page([{ ...message(1), conversationId: fixtureId(9) }]),
      me,
    ).history(conversationId),
    AppError,
  );
  await assert.rejects(
    createMessagesApi(async () => conversation, fixtureId(9)).detail(
      conversationId,
    ),
    AppError,
  );
  const first = message(1, "9007199254740992"),
    second = message(2, "9007199254740993");
  assert.deepEqual(
    mergeMessages(
      [second, first],
      [{ ...first, readAt: proposal.createdAt }],
    ).map((m) => [m.id, m.readAt]),
    [
      [first.id, proposal.createdAt],
      [second.id, null],
    ],
  );
});
test("forward chat backlog uses hasMore without an older-history cursor, matching the server", async () => {
  const api = createMessagesApi(
    async () => ({
      data: [message(2)],
      meta: { pagination: { limit: 20, hasMore: true, nextCursor: null } },
    }),
    me,
  );
  const forward = await api.history(conversationId, { afterSequence: "1" });
  assert.equal(forward.hasMore, true);
  assert.equal(forward.nextCursor, null);
  await assert.rejects(api.history(conversationId), AppError);
});
test("read markers submit message identity and never a client-defined watermark or actor", async () => {
  let body: unknown;
  const api = createMessagesApi(async (_path, options) => {
    body = options?.body;
    return {
      lastReadSequence: "9007199254740993",
      lastReadAt: proposal.createdAt,
    };
  }, me);
  await api.read(conversationId, fixtureId(701));
  assert.deepEqual(body, { messageId: fixtureId(701) });
});
test("chat files enforce the actual decimal-byte cap and preserve multipart file bytes", async () => {
  assert.equal(
    validateChatFile({
      name: "report.xlsx",
      uri: "local://file",
      size: CHAT_MAX_BYTES,
    }).size,
    CHAT_MAX_BYTES,
  );
  for (const file of [
    { name: "report.pdf", size: CHAT_MAX_BYTES + 1 },
    { name: "report.exe.pdf", size: 50 },
    { name: "report.pdf", size: undefined },
    { name: "report.pdf", size: 5, mimeType: "image/png" },
  ])
    assert.throws(() => validateChatFile({ uri: "local://file", ...file }));
  const original = new File(["test document"], "note.txt", {
    type: "text/plain",
  });
  const form = chatFileFormData({
    name: original.name,
    uri: "local://file",
    file: original,
  });
  const uploaded = form.get("file");
  assert.ok(uploaded instanceof File);
  assert.equal(await uploaded.text(), await original.text());
  assert.equal(form.get("storageKey"), null);
});
test("SSE parser handles split frames, CRLF, multiline data, heartbeat and opaque cursors", () => {
  const parser = createSseParser();
  assert.deepEqual(
    parser.feed(": heartbeat\r\n\r\nid: opaque-cursor\r\nevent: chat.message."),
    [],
  );
  assert.deepEqual(
    parser.feed("created\r\ndata: first\r\ndata: second\r\n\r\n"),
    [
      {
        event: "chat.message.created",
        id: "opaque-cursor",
        data: "first\nsecond",
      },
    ],
  );
  assert.deepEqual(parser.feed("event: stream.reauth-required\n\n"), [
    { event: "stream.reauth-required", id: undefined, data: "" },
  ]);
  assert.throws(() => createSseParser().feed("x".repeat(262145)), AppError);
});
test("learning suggestions remain plain negotiation and obey the chat text limit", async () => {
  const draft = {
    type: "TWO_WAY" as const,
    role: "teacher" as const,
    credit: "20",
    skill: "React",
    goal: "Tự xây dựng ứng dụng React",
    outline: "Component và state\nHook và dự án thực hành",
  };
  const text = negotiationMessage(draft);
  assert.ok(text.includes("CHƯA XÁC NHẬN"));
  assert.ok(text.includes("Tôi dạy → bạn học"));
  assert.ok(text.length <= 2000);
  assert.equal(
    negotiationSchema.safeParse({ ...draft, credit: "19.99" }).success,
    false,
  );
  assert.equal(
    negotiationSchema.safeParse({
      ...draft,
      goal: "x".repeat(500),
      skill: "x".repeat(100),
      outline: Array(100).fill("nội dung").join("\n"),
    }).success,
    false,
  );
});
