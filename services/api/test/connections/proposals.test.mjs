import "reflect-metadata";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { ProposalsService } from "../../dist/modules/proposals/application/proposals.service.js";
import { ConversationLifecycleService } from "../../dist/modules/conversations/application/conversation-lifecycle.service.js";
import { ConnectionNotificationService } from "../../dist/modules/notifications/application/services/connection-notification.service.js";
import { connectionSettings } from "../../dist/modules/proposals/domain/connection-policy.js";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { SendMessageDto } from "../../dist/modules/conversations/presentation/conversations.dto.js";
import {
  CreateProposalDto,
  ChangeProposalDto,
} from "../../dist/modules/proposals/presentation/proposals.dto.js";

function fixture() {
  const proposerId = randomUUID(),
    recipientId = randomUUID(),
    id = randomUUID(),
    requestId = randomUUID(),
    skillId = randomUUID();
  let row = {
    id,
    proposerId,
    recipientId,
    skillId,
    requestId,
    sourceType: "LEARNING_REQUEST",
    targetSharingSkillId: null,
    message: "A suitable invitation",
    candidateSlots: null,
    proposedCredit: null,
    exchangeTypeHint: null,
    proposedDurationMinutes: 60,
    initialSessionCount: null,
    status: "PENDING",
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    expiresAt: new Date(Date.now() + 86400000),
    terminalAt: null,
  };
  const calls = [];
  let dayCount = 0,
    hourCount = 0,
    cooldown = false;
  let conversation;
  const tx = {
    $queryRaw: async (strings) => {
      calls.push(strings.join("?"));
      return strings.join("").includes("clock_timestamp")
        ? [{ now: new Date() }]
        : [];
    },
    $executeRaw: async () => 1,
    proposal: {
      findUnique: async () => row,
      update: async ({ data }) => {
        row = { ...row, ...data, version: row.version + 1 };
        return row;
      },
      count: async ({ where }) =>
        Date.now() - where.createdAt.gt.getTime() > 7200000
          ? dayCount
          : hourCount,
      findFirst: async () => (cooldown ? row : null),
      create: async ({ data }) => {
        row = { ...row, ...data, createdAt: new Date() };
        return row;
      },
    },
    conversation: {
      create: async ({ data }) => {
        conversation = { id: randomUUID(), ...data };
        return conversation;
      },
      findUnique: async () => conversation,
      findUniqueOrThrow: async () => conversation,
    },
    notification: { create: async () => ({}) },
  };
  const actors = {
    require: async (_tx, principal, permission, others) => {
      calls.push({ permission, user: principal.userId, others });
      return { userId: principal.userId, roles: ["USER"] };
    },
    assertConnectionParty: async () => {},
  };
  const requests = {
    proposalSource: async () => ({ requestId, ownerId: recipientId, skillId }),
    lockForProposal: async () => ({
      requestId,
      ownerId: recipientId,
      skillId,
      verifiedTeacherOnly: true,
      version: 7,
    }),
    beginNegotiation: async (...args) =>
      calls.push({ negotiation: args.slice(1) }),
  };
  const sharing = {
    read: async () => ({ userId: recipientId, skillId }),
    assertTeacherEligible: async () => calls.push("teacher"),
    connectionTarget: async () => ({ userId: recipientId, skillId }),
  };
  const commands = {
    execute: async (_input, work, authorize) => {
      await authorize(tx);
      calls.push("work");
      return { value: await work(tx), replayed: false };
    },
  };
  const service = new ProposalsService(
    tx,
    { run: (work) => work(tx) },
    commands,
    actors,
    sharing,
    requests,
    {
      append: async (...args) => calls.push({ event: args[3] }),
      lockRecipients: async () => {},
    },
    { policy: connectionSettings({}) },
    { append: async () => {} },
    new ConversationLifecycleService(),
    new ConnectionNotificationService(),
  );
  const command = {
    principal: {
      userId: recipientId,
      sessionId: randomUUID(),
      roles: ["USER"],
      permissions: [],
    },
    key: "test",
    context: { requestId: randomUUID(), correlationId: randomUUID() },
  };
  return {
    service,
    command,
    calls,
    id,
    quota(day, hour, hasCooldown = false) {
      dayCount = day;
      hourCount = hour;
      cooldown = hasCooldown;
    },
    get row() {
      return row;
    },
    set row(value) {
      row = value;
    },
  };
}
test("direct invitation derives target parties without requiring proposer's teaching skill; expiry is seven days", async () => {
  const f = fixture();
  f.command.principal.userId = f.row.proposerId;
  const target = randomUUID();
  const result = await f.service.create(f.command, {
    sourceType: "DIRECT_SEARCH",
    recipientSharingSkillId: target,
    message: "A suitable invitation",
  });
  assert.equal(result.proposal.recipientId, f.row.recipientId);
  assert.equal(f.row.targetSharingSkillId, target);
  assert.equal(result.proposal.learningRequestId, null);
  assert(!f.calls.includes("teacher"));
  assert(
    Math.abs(
      f.row.expiresAt.getTime() - f.row.createdAt.getTime() - 7 * 86400000,
    ) < 1000,
  );
});
test("proposal rolling quotas and direct cooldown reject before creating another proposal", async () => {
  for (const [day, hour, cooldown, expected] of [
    [50, 0, false, "PROPOSAL_RATE_LIMIT"],
    [0, 10, false, "PROPOSAL_RATE_LIMIT"],
    [0, 0, true, "DIRECT_INVITATION_COOLDOWN"],
  ]) {
    const f = fixture();
    f.command.principal.userId = f.row.proposerId;
    f.quota(day, hour, cooldown);
    await assert.rejects(
      f.service.create(f.command, {
        sourceType: "DIRECT_SEARCH",
        recipientSharingSkillId: randomUUID(),
        message: "A suitable invitation",
      }),
      new RegExp(expected),
    );
    assert.equal(f.row.targetSharingSkillId, null);
  }
  const f = fixture();
  f.command.principal.userId = f.row.proposerId;
  f.quota(49, 9);
  assert.equal(
    (
      await f.service.create(f.command, {
        sourceType: "LEARNING_REQUEST",
        learningRequestId: f.row.requestId,
        message: "A suitable invitation",
      })
    ).proposal.sourceType,
    "LEARNING_REQUEST",
  );
  assert(f.calls.includes("teacher"));
});
test("accept revalidates the current Request then opens negotiation with one Conversation", async () => {
  const f = fixture();
  const result = await f.service.mutate(f.command, f.id, "accept", {
    expectedVersion: 1,
    expectedRequestVersion: 7,
  });
  assert.equal(result.proposal.status, "ACCEPTED");
  assert.equal(result.conversation.proposalId, f.id);
  assert.deepEqual(f.calls.find((call) => call.negotiation).negotiation, [
    f.row.requestId,
    7,
  ]);
  const auth = f.calls.find(
    (call) => call.permission === "proposal:accept:recipient",
  );
  assert.deepEqual(
    new Set(auth.others),
    new Set([f.row.proposerId, f.row.recipientId]),
  );
  assert(f.calls.indexOf(auth) < f.calls.indexOf("work"));
});
test("stale source, expired proposal and nonrecipient cannot accept", async () => {
  const f = fixture();
  await assert.rejects(
    f.service.mutate(f.command, f.id, "accept", {
      expectedVersion: 1,
      expectedRequestVersion: 6,
    }),
    /REQUEST_VERSION_CONFLICT/,
  );
  f.row = { ...f.row, expiresAt: new Date(0) };
  await assert.rejects(
    f.service.mutate(f.command, f.id, "accept", { expectedVersion: 1 }),
    /PROPOSAL_EXPIRED/,
  );
  f.command.principal.userId = randomUUID();
  await assert.rejects(
    f.service.mutate(f.command, f.id, "accept", { expectedVersion: 1 }),
    (error) => error.getStatus() === 404,
  );
});
test("update preserves server expiry and null explicitly clears hints", async () => {
  const f = fixture(),
    expiry = f.row.expiresAt;
  f.command.principal.userId = f.row.proposerId;
  const result = await f.service.mutate(f.command, f.id, "update", {
    expectedVersion: 1,
    proposedDurationMinutes: null,
  });
  assert.equal(result.proposal.proposedDurationMinutes, null);
  assert.equal(result.proposal.expiresAt, expiry);
});

test("create returns schedule text; update omission preserves it and null or blank clears it", async () => {
  const f = fixture();
  f.command.principal.userId = f.row.proposerId;
  const created = await f.service.create(f.command, {
    sourceType: "DIRECT_SEARCH",
    recipientSharingSkillId: randomUUID(),
    message: "A suitable invitation",
    candidateSlots: "  Tối Thứ 5 và Thứ 7  ",
  });
  assert.equal(created.proposal.candidateSlots, "Tối Thứ 5 và Thứ 7");
  const expiry = f.row.expiresAt;
  for (const [changes, expected] of [
    [{ message: "An updated invitation" }, "Tối Thứ 5 và Thứ 7"],
    [{ candidateSlots: null }, null],
    [{ candidateSlots: "Cuối tuần" }, "Cuối tuần"],
    [{ candidateSlots: "  " }, null],
  ]) {
    const result = await f.service.mutate(f.command, f.id, "update", {
      expectedVersion: f.row.version,
      ...changes,
    });
    assert.equal(result.proposal.candidateSlots, expected);
    assert.equal(result.proposal.expiresAt, expiry);
  }
});

test("create and PATCH DTOs accept optional schedule text and reject old slot arrays", async () => {
  for (const [Dto, base] of [
    [
      CreateProposalDto,
      {
        sourceType: "DIRECT_SEARCH",
        recipientSharingSkillId: randomUUID(),
        message: "A suitable invitation",
      },
    ],
    [ChangeProposalDto, { expectedVersion: 1 }],
  ]) {
    for (const value of [
      undefined,
      null,
      "",
      "Tối Thứ 5 và Thứ 7",
      [],
      [{ startAt: "2030-01-01T00:00:00Z", endAt: "2030-01-01T01:00:00Z" }],
      {},
      5,
    ]) {
      const errors = await validate(
        plainToInstance(Dto, { ...base, candidateSlots: value }),
        {
          whitelist: true,
          forbidNonWhitelisted: true,
        },
      );
      assert.equal(
        errors.length === 0,
        value == null || typeof value === "string",
      );
    }
  }
});
test("HTTP command validation rejects injected system cards and actor metadata", async () => {
  for (const [Dto, body] of [
    [
      SendMessageDto,
      {
        clientMessageId: randomUUID(),
        messageText: "Hi",
        messageType: "SYSTEM",
        senderId: randomUUID(),
      },
    ],
    [
      CreateProposalDto,
      {
        sourceType: "DIRECT_SEARCH",
        recipientSharingSkillId: randomUUID(),
        message: "A suitable invitation",
        recipientId: randomUUID(),
      },
    ],
  ]) {
    const errors = await validate(plainToInstance(Dto, body), {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    assert(errors.length > 0);
  }
});
