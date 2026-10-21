import assert from "node:assert/strict";
import { test } from "node:test";
import { CreditOperationsService } from "../../dist/modules/credit/application/services/credit-operations.service.js";

function setup(wallet = {}) {
  const current = {
    userId: "11111111-1111-4111-8111-111111111111",
    availableCredit: 1000n,
    heldCredit: 200n,
    purchasedCredit: 1000n,
    bonusCredit: 0n,
    walletVersion: 2,
    provenanceTracked: true,
    ...wallet,
  };
  const operations = new Map();
  const lots = [];
  const transactions = [];
  const updates = [];
  const tx = {
    creditWallet: {
      upsert: async () => {},
      findUniqueOrThrow: async () => current,
      update: async ({ data }) => {
        updates.push(data);
        current.availableCredit = data.availableCredit;
        if (data.walletVersion?.increment)
          current.walletVersion += data.walletVersion.increment;
      },
    },
    $queryRaw: async () => [],
    creditOperation: {
      findUnique: async ({ where }) =>
        operations.get(where.idempotencyKey) ?? null,
      create: async ({ data }) => {
        const result = { id: `operation-${operations.size + 1}`, ...data };
        operations.set(data.idempotencyKey, result);
        return result;
      },
    },
    creditLot: { create: async ({ data }) => lots.push(data) },
    creditTransaction: { create: async ({ data }) => transactions.push(data) },
  };
  const provenance = {
    requireTracked: async () => {},
    spend: async (_tx, _userId, amount) => ({ purchased: amount, bonus: 0n }),
  };
  return {
    service: new CreditOperationsService(provenance),
    tx,
    current,
    lots,
    transactions,
    updates,
  };
}

const instruction = {
  userId: "11111111-1111-4111-8111-111111111111",
  amount: 500n,
  referenceId: "case-1",
  actorId: "admin-1",
  reason: "Case resolution adjustment",
  idempotencyKey: "report-case:case-1:adjust:0",
};

test("Admin adjustment appends an Available-only ledger entry and is idempotent", async () => {
  const ctx = setup();
  const first = await ctx.service.adjustAvailable(ctx.tx, instruction);
  const replay = await ctx.service.adjustAvailable(ctx.tx, instruction);

  assert.equal(replay.operationId, first.operationId);
  assert.equal(ctx.current.availableCredit, 1500n);
  assert.equal(ctx.current.heldCredit, 200n);
  assert.equal(ctx.current.walletVersion, 3);
  assert.equal(ctx.lots.length, 1);
  assert.deepEqual(
    [
      ctx.transactions.length,
      ctx.transactions[0].availableDelta,
      ctx.transactions[0].heldDelta,
    ],
    [1, 500n, 0n],
  );
});

test("negative adjustment refuses to make Available negative", async () => {
  const ctx = setup({ availableCredit: 100n });
  await assert.rejects(
    ctx.service.adjustAvailable(ctx.tx, { ...instruction, amount: -101n }),
    /INSUFFICIENT_AVAILABLE_CREDIT/,
  );
  assert.equal(ctx.transactions.length, 0);
  assert.equal(ctx.current.availableCredit, 100n);
});

test("material refund returns gross and debits only seller net when Available covers it", async () => {
  const buyerId = "22222222-2222-4222-8222-222222222222";
  const sellerId = "33333333-3333-4333-8333-333333333333";
  const wallets = new Map([
    [
      buyerId,
      {
        userId: buyerId,
        availableCredit: 100n,
        heldCredit: 0n,
        purchasedCredit: 100n,
        bonusCredit: 0n,
        walletVersion: 0,
        provenanceTracked: true,
      },
    ],
    [
      sellerId,
      {
        userId: sellerId,
        availableCredit: 1200n,
        heldCredit: 0n,
        purchasedCredit: 1200n,
        bonusCredit: 0n,
        walletVersion: 0,
        provenanceTracked: true,
      },
    ],
  ]);
  const transactions = [];
  const lots = [];
  const operations = new Map();
  const tx = {
    creditWallet: {
      upsert: async ({ where, create }) => {
        if (!wallets.has(where.userId)) wallets.set(where.userId, create);
      },
      findUniqueOrThrow: async ({ where }) => wallets.get(where.userId),
      update: async ({ where, data }) => {
        const wallet = wallets.get(where.userId);
        if (data.availableCredit !== undefined)
          wallet.availableCredit = data.availableCredit;
        if (data.purchasedCredit?.decrement)
          wallet.purchasedCredit -= data.purchasedCredit.decrement;
        if (data.walletVersion?.increment)
          wallet.walletVersion += data.walletVersion.increment;
      },
    },
    $queryRaw: async () => [],
    creditOperation: {
      findUnique: async ({ where }) =>
        operations.get(where.idempotencyKey) ?? null,
      create: async ({ data }) => {
        const result = { id: "refund-operation", ...data };
        operations.set(data.idempotencyKey, result);
        return result;
      },
    },
    creditLot: { create: async ({ data }) => lots.push(data) },
    creditTransaction: { create: async ({ data }) => transactions.push(data) },
  };
  const provenance = {
    requireTracked: async () => {},
    spend: async (_tx, _userId, amount) => ({ purchased: amount, bonus: 0n }),
  };
  const service = new CreditOperationsService(provenance);
  await service.refundMaterial(tx, {
    orderId: "order-1",
    buyerId,
    sellerId,
    gross: 1000n,
    net: 950n,
  });
  assert.equal(wallets.get(buyerId).availableCredit, 1100n);
  assert.equal(wallets.get(sellerId).availableCredit, 250n);
  assert.deepEqual(
    transactions.map(({ availableDelta, heldDelta }) => [
      availableDelta,
      heldDelta,
    ]),
    [
      [1000n, 0n],
      [-950n, 0n],
    ],
  );
});

test("settlement reversal claws back Available payouts and leaves settled Holds untouched", async () => {
  const userIds = [
    "44444444-4444-4444-8444-444444444444",
    "55555555-5555-4555-8555-555555555555",
  ];
  const originalEntries = userIds.map((userId, index) => ({
    id: `settlement-entry-${index + 1}`,
    userId,
    entryNo: index + 1,
    availableDelta: index === 0 ? 500n : 400n,
  }));
  const original = {
    operationType: "PATH_SETTLEMENT",
    referenceType: "LEARNING_PATH",
    referenceId: "path-1",
    status: "SUCCESS",
    creditTransactionOperationIdRecords: originalEntries,
  };
  const wallets = new Map(
    userIds.map((userId, index) => [
      userId,
      {
        userId,
        availableCredit: index === 0 ? 900n : 700n,
        heldCredit: 125n,
        purchasedCredit: 900n,
        bonusCredit: 0n,
        walletVersion: 0,
        provenanceTracked: true,
      },
    ]),
  );
  const createdOperations = [];
  const createdEntries = [];
  const tx = {
    creditWallet: {
      upsert: async () => {},
      findUniqueOrThrow: async ({ where }) => wallets.get(where.userId),
      update: async ({ where, data }) => {
        const wallet = wallets.get(where.userId);
        if (data.availableCredit !== undefined)
          wallet.availableCredit = data.availableCredit;
        if (data.walletVersion?.increment)
          wallet.walletVersion += data.walletVersion.increment;
      },
    },
    $queryRaw: async () => [],
    creditOperation: {
      findUnique: async ({ where }) => {
        if (where.idempotencyKey) return null;
        return where.id === "settlement-1" ? original : null;
      },
      create: async ({ data }) => {
        const operation = { id: "reversal-1", ...data };
        createdOperations.push(operation);
        return operation;
      },
    },
    creditTransaction: {
      findMany: async () => [],
      create: async ({ data }) => createdEntries.push(data),
    },
    creditLot: { create: async () => {} },
  };
  const service = new CreditOperationsService({
    requireTracked: async () => {},
    spend: async (_tx, _userId, amount) => ({ purchased: amount, bonus: 0n }),
  });
  await service.reversePathAvailable(tx, {
    operationId: "settlement-1",
    referenceId: "case-1",
    sourceReferenceId: "path-1",
    actorId: "admin-1",
    reason: "Confirmed settlement reversal",
    idempotencyKey: "report-case:case-1:reverse:settlement-1",
  });
  assert.deepEqual(
    userIds.map((id) => wallets.get(id).availableCredit),
    [400n, 300n],
  );
  assert.deepEqual(
    userIds.map((id) => wallets.get(id).heldCredit),
    [125n, 125n],
  );
  assert.deepEqual(
    createdEntries.map(
      ({ availableDelta, heldDelta, reversesTransactionId, type }) => [
        availableDelta,
        heldDelta,
        reversesTransactionId,
        type,
      ],
    ),
    [
      [-500n, 0n, originalEntries[0].id, "ADJUSTMENT"],
      [-400n, 0n, originalEntries[1].id, "ADJUSTMENT"],
    ],
  );
  assert.equal(createdOperations[0].referenceId, "case-1");
});
