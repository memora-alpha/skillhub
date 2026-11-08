import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assertPrivateCaseThread,
  assertSameIncident,
  assertIndependentCaseActor,
} from "../dist/modules/reports/domain/report-support.policy.js";
import { CaseMessagesService } from "../dist/modules/reports/application/services/case-messages.service.js";
import { ReportSupportService } from "../dist/modules/reports/application/services/report-support.service.js";
const partyA = "11111111-1111-4111-8111-111111111111",
  partyB = "22222222-2222-4222-8222-222222222222";
const handler = "33333333-3333-4333-8333-333333333333",
  caseId = "44444444-4444-4444-8444-444444444444";

test("incident authorization batches related parties and never exposes them in the case projection", async () => {
  const cases = Array.from({ length: 100 }, (_, index) => ({
    id: String(index),
    status: "UNDER_REVIEW",
    severity: "HIGH",
    version: 1,
    reporterId: partyA,
    targetType: "SESSION",
    targetId: "session",
    relatedPathId: "path",
    relatedOrderId: "order",
  }));
  let pathReads = 0,
    orderReads = 0;
  const tx = {
    reportIncident: { findUnique: async () => ({ id: "incident", cases }) },
    learningPath: {
      findMany: async () => {
        pathReads++;
        return [{ id: "path", participantAId: partyA, participantBId: partyB }];
      },
    },
    materialOrder: {
      findMany: async () => {
        orderReads++;
        return [{ id: "order", buyerId: partyA, sellerId: partyB }];
      },
    },
  };
  const service = new ReportSupportService(
    { run: async (work) => work(tx) },
    {
      require: async () => ({
        roles: ["STAFF"],
        permissions: new Set(["report:group", "report:moderate"]),
        blockedPermissions: new Set(),
      }),
    },
    {},
    {},
  );
  const view = await service.incident({ userId: handler }, "incident");
  assert.equal(pathReads, 1);
  assert.equal(orderReads, 1);
  assert.deepEqual(Object.keys(view.cases[0]).sort(), [
    "id",
    "severity",
    "status",
    "version",
  ]);
  cases[99].reporterId = handler;
  await assert.rejects(
    service.incident({ userId: handler }, "incident"),
    /REPORT_SELF_MODERATION_FORBIDDEN/,
  );
  cases[99].reporterId = partyA;
  await assert.rejects(
    service.incident({ userId: partyB }, "incident"),
    /REPORT_SELF_MODERATION_FORBIDDEN/,
  );
});

test("group decision shares one transaction and applies attendance ruling only once", async () => {
  const incidentId = "66666666-6666-4666-8666-666666666666";
  const cases = [caseId, "77777777-7777-4777-8777-777777777777"].map((id) => ({
    id,
    targetType: "SESSION",
    targetId: "session",
    relatedPathId: "path",
    relatedSessionId: "session",
    handlerId: handler,
    reporterId: partyA,
    status: "UNDER_REVIEW",
    incidentId,
  }));
  const tx = {
    $queryRawUnsafe: async () => [],
    reportIncident: {
      findUnique: async () => ({
        id: incidentId,
        status: "OPEN",
        handlerId: handler,
        version: 1,
      }),
      update: async ({ data }) => ({ id: incidentId, ...data }),
    },
    reportCase: {
      findMany: async () => cases,
      findUnique: async ({ where }) => cases.find((row) => row.id === where.id),
    },
    learningPath: {
      findMany: async () => [
        {
          id: "path",
          participantAId: partyA,
          participantBId: partyB,
        },
      ],
    },
  };
  const calls = [];
  let active = false;
  const service = new ReportSupportService(
    { run: async (work) => work(tx) },
    {
      require: async () => ({
        roles: ["STAFF"],
        permissions: new Set(["report:group", "report:moderate"]),
        blockedPermissions: new Set(),
      }),
    },
    {
      updateCaseInTransaction: async (...args) => {
        assert.equal(active, false, "case transitions must not overlap");
        active = true;
        await new Promise((resolve) => setImmediate(resolve));
        calls.push(args);
        active = false;
      },
    },
    { append: async () => {} },
  );
  const result = await service.decide({ userId: handler }, incidentId, {
    action: "resolve",
    expectedVersion: 1,
    note: "Same incident resolved",
    noShowRuling: "COMPLETE",
  });
  assert.equal(result.status, "RESOLVED");
  assert.equal(calls.length, 2);
  assert.ok(calls.every((args) => args[0] === tx && args[5] === true));
  assert.equal(calls[0][4].noShowRuling, "COMPLETE");
  assert.equal("noShowRuling" in calls[1][4], false);
  assert.equal(
    calls.some((args) => args[4].creditAdjustments || args[4].violations),
    false,
  );
});
test("a private case thread is readable by its party and current assigned handler only", () => {
  const parties = [partyA, partyB];
  assertPrivateCaseThread(partyA, partyA, handler, parties, false);
  assertPrivateCaseThread(handler, partyA, handler, parties, true);
  assert.throws(
    () => assertPrivateCaseThread(partyB, partyA, handler, parties, true),
    /CASE_THREAD_ACCESS_DENIED/,
  );
  assert.throws(
    () =>
      assertPrivateCaseThread("old-handler", partyA, handler, parties, true),
    /CASE_THREAD_ACCESS_DENIED/,
  );
  assert.throws(
    () => assertPrivateCaseThread(handler, partyA, handler, parties, false),
    /CASE_THREAD_ACCESS_DENIED/,
  );
  assert.throws(
    () => assertIndependentCaseActor(partyA, parties),
    /REPORT_SELF_MODERATION_FORBIDDEN/,
  );
});
test("matching target alone cannot merge reports across distinct paths or session occurrences", () => {
  const first = {
    targetType: "SESSION",
    targetId: "same",
    relatedPathId: "path",
    relatedSessionId: "session",
  };
  assertSameIncident([first, { ...first }]);
  assert.throws(
    () => assertSameIncident([first, { ...first, relatedPathId: "other" }]),
    /REPORT_INCIDENT_TARGET_MISMATCH/,
  );
  assert.throws(
    () => assertSameIncident([]),
    /REPORT_INCIDENT_TARGET_MISMATCH/,
  );
});
test("message stages outside PG, becomes visible via receipt, retries safely and rejects cross-party reads", async () => {
  const receipts = new Map(),
    documents = new Map(),
    events = [];
  let transactionActive = false;
  const item = { handlerId: handler, status: "NEED_MORE_INFO", version: 1 };
  const tx = {
    $queryRawUnsafe: async () => [],
    reportMessageReceipt: {
      findUnique: async ({ where }) => receipts.get(where.messageId),
      create: async ({ data }) => {
        const row = { ...data, createdAt: new Date() };
        receipts.set(data.messageId, row);
        return row;
      },
      findMany: async () => [...receipts.values()],
    },
    outboxEvent: { create: async ({ data }) => events.push(data) },
    reportCase: {
      update: async ({ data }) => {
        item.status = data.status;
      },
    },
  };
  const service = new CaseMessagesService(
    {
      run: async (work) => {
        transactionActive = true;
        try {
          return await work(tx);
        } finally {
          transactionActive = false;
        }
      },
    },
    {
      require: async (_tx, actor) => ({
        ...actor,
        roles: ["STAFF"],
        permissions: new Set(["report:communicate", "report:moderate"]),
        blockedPermissions: new Set(),
      }),
    },
    { parties: async () => ({ item, parties: [partyA, partyB] }) },
    {
      stage: async (message) => {
        assert.equal(transactionActive, false);
        const old = documents.get(message._id);
        if (old && old.digest !== message.digest)
          throw new Error("CASE_MESSAGE_ID_REUSED");
        documents.set(message._id, message);
      },
      read: async (ids) => ids.map((id) => documents.get(id)),
    },
  );
  const command = {
    clientMessageId: "55555555-5555-4555-8555-555555555555",
    text: "Requested details",
  };
  const one = await service.send({ userId: partyA }, caseId, partyA, command);
  assert.equal(item.status, "UNDER_REVIEW");
  assert.equal(
    (await service.send({ userId: partyA }, caseId, partyA, command)).id,
    one.id,
  );
  assert.equal(receipts.size, 1);
  assert.equal(events.length, 1);
  assert.equal("text" in events[0].payload, false);
  const page = await service.list({ userId: handler }, caseId, partyA);
  assert.equal(page.data[0].text, command.text);
  await assert.rejects(
    service.list({ userId: partyB }, caseId, partyA),
    /CASE_THREAD_ACCESS_DENIED/,
  );
  await assert.rejects(
    service.send({ userId: partyA }, caseId, partyA, {
      ...command,
      text: "changed",
    }),
    /CASE_MESSAGE_ID_REUSED/,
  );
});
