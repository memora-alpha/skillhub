import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { CreditLedgerService } from "../dist/modules/credit/application/services/credit-ledger.service.js";
import { draftDigest } from "../dist/modules/conversations/infrastructure/persistence/chat.repository.js";
import { FileStorageError } from "../dist/infrastructure/storage/file.types.js";
import { normalizeMessage } from "../dist/modules/proposals/domain/connection-policy.js";

function settlementFixture(exchangeType) {
  const now = new Date("2026-10-12T00:00:00Z");
  const path = { id: "path", settlementOperationId: null };
  const wallets = new Map([
    [
      "learner",
      { userId: "learner", availableCredit: 1000n, heldCredit: 2000n },
    ],
    [
      "teacher",
      {
        userId: "teacher",
        availableCredit: 500n,
        heldCredit: exchangeType === "TWO_WAY" ? 2000n : 0n,
      },
    ],
  ]);
  const allocations = [...wallets.values()]
    .filter((wallet) => wallet.heldCredit > 0n)
    .map((wallet) => ({
      id: `hold-${wallet.userId}`,
      userId: wallet.userId,
      beneficiaryId: "teacher",
      amount: 2000n,
      remainingHeld: 2000n,
    }));
  const entries = [],
    locks = [],
    completedHolds = [],
    outbox = [];
  const policy = {
    id: "policy",
    policyCode: exchangeType,
    status: "APPROVED",
    approvedAt: now,
    effectiveAt: now,
    calculationRule: { returnedBps: 9600, feeBps: 400 },
    roundingRule: { mode: "DOWN", precision: 2 },
    versionNo: 1,
  };
  const tx = {
    learningPath: {
      findUniqueOrThrow: () => ({ ...path }),
      update: ({ data }) => Object.assign(path, data),
    },
    learningPathVersion: {
      findUniqueOrThrow: () => ({
        feePolicyId: "policy",
        feeRateSnapshot: "0.04",
      }),
    },
    feePolicyVersion: { findUnique: () => policy },
    heldCreditAllocation: {
      findMany: () => allocations,
      update: ({ where }) => completedHolds.push(where.id),
    },
    creditOperation: {
      findUnique: () => null,
      create: () => ({ id: "operation" }),
    },
    $queryRaw: (_sql, userId) => {
      locks.push(userId);
      return [];
    },
    creditWallet: {
      findMany: () => [...wallets.values()].map((wallet) => ({ ...wallet })),
      update: ({ where, data }) =>
        Object.assign(wallets.get(where.userId), data),
    },
    creditTransaction: { create: ({ data }) => entries.push(data) },
    outboxEvent: { create: ({ data }) => outbox.push(data) },
  };
  return {
    tx,
    wallets,
    entries,
    locks,
    completedHolds,
    outbox,
    policy,
    input: { pathId: "path", pathVersion: 1, exchangeType, now },
  };
}

test("ONE_WAY settlement pays the teacher, records the fee, and replays the path snapshot", async () => {
  const f = settlementFixture("ONE_WAY");
  const service = new CreditLedgerService();
  const result = await service.settlePath(f.tx, f.input);
  assert.deepEqual(result, {
    operationId: "operation",
    gross: 2000n,
    fee: 80n,
  });
  assert.equal(f.wallets.get("learner").availableCredit, 1000n);
  assert.equal(f.wallets.get("learner").heldCredit, 0n);
  assert.equal(f.wallets.get("teacher").availableCredit, 2420n);
  assert.deepEqual(
    f.entries.map(({ type }) => type),
    ["TEACHING_PAYMENT", "TEACHING_EARNING", "PLATFORM_FEE"],
  );
  assert.equal(
    f.entries.reduce((sum, entry) => sum + entry.heldDelta, 0n),
    -2000n,
  );
  assert.deepEqual(
    f.entries.map(({ entryNo }) => entryNo),
    [1, 2, 3],
  );
  assert.deepEqual(f.locks, ["learner", "teacher"]);
  assert.deepEqual(await service.settlePath(f.tx, f.input), result);
  assert.equal(f.entries.length, 3);
  assert.equal(f.outbox.length, 1);
});

test("TWO_WAY settlement returns credit to each holder with conserved ledger deltas", async () => {
  const f = settlementFixture("TWO_WAY");
  const result = await new CreditLedgerService().settlePath(f.tx, f.input);
  assert.equal(result.gross, 4000n);
  assert.equal(result.fee, 160n);
  assert.equal(f.wallets.get("learner").availableCredit, 2920n);
  assert.equal(f.wallets.get("teacher").availableCredit, 2420n);
  assert.equal(f.wallets.get("learner").heldCredit, 0n);
  assert.equal(f.wallets.get("teacher").heldCredit, 0n);
  assert.equal(
    f.entries.reduce((sum, entry) => sum + entry.availableDelta, 0n),
    3840n,
  );
  assert.equal(
    f.entries.reduce((sum, entry) => sum + entry.heldDelta, 0n),
    -4000n,
  );
  assert.deepEqual(
    f.entries.map(({ entryNo }) => entryNo),
    [1, 2, 3, 4],
  );
  assert.equal(f.completedHolds.length, 2);
});

test("unsupported fee policy rejects settlement before wallet locks or ledger writes", async () => {
  const f = settlementFixture("ONE_WAY");
  f.policy.calculationRule.feeBps = 500;
  await assert.rejects(
    new CreditLedgerService().settlePath(f.tx, f.input),
    /UNSUPPORTED_FEE_POLICY/,
  );
  assert.deepEqual(f.locks, []);
  assert.deepEqual(f.entries, []);
  assert.equal(f.wallets.get("learner").heldCredit, 2000n);
});

test("message attachment permutations produce one normalized command", () => {
  const first = "00000000-0000-4000-8000-000000000001";
  const second = "aaaaaaaa-0000-4000-8000-000000000002";
  assert.deepEqual(
    normalizeMessage({ attachmentFileIds: [second, first] }),
    normalizeMessage({ attachmentFileIds: [first, second] }),
  );
  const upper = "B0000000-0000-4000-8000-000000000001";
  const lower = "a0000000-0000-4000-8000-000000000002";
  assert.deepEqual(
    normalizeMessage({ attachmentFileIds: [lower, upper] }).attachmentFileIds,
    [upper, lower],
    "Mixed-case UUID order must preserve existing idempotency digests",
  );
});

test("draft digest intentionally treats omitted and undefined optional fields equally", () => {
  const message = {
    _id: "id",
    conversationId: "conversation",
    senderId: "user",
    clientMessageId: "client",
    messageText: "Hello",
    messageType: "TEXT",
    attachments: [],
    commandDigest: "command",
    draftFormatVersion: 1,
  };
  assert.equal(
    draftDigest(message),
    draftDigest({
      ...message,
      objectType: undefined,
      objectId: undefined,
      objectVersion: undefined,
    }),
  );
  assert.notEqual(
    draftDigest(message),
    draftDigest({ ...message, messageText: "Changed" }),
  );
});

test("storage rejection is an Error with the required HTTP semantics", () => {
  const error = new FileStorageError("FILE_STORAGE_UNAVAILABLE", 503);
  assert(error instanceof Error);
  assert.equal(error.getStatus(), 503);
});
