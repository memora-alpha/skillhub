import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { CreditLedgerService } from "../../dist/modules/credit/application/services/credit-ledger.service.js";
import { seedPathFeePolicies } from "../../dist/modules/credit/application/seed-fee-policies.js";
import { createPaymentFixture } from "./fixture.mjs";

async function pathFixture(f, a, b, exchangeType, amount) {
  const skill = await f.db.skill.create({
    data: {
      name: randomUUID(),
      nameKey: randomUUID(),
      slug: randomUUID(),
      status: "ACTIVE",
    },
  });
  const request = await f.db.learningRequest.create({
    data: {
      ownerId: b.user.id,
      skillId: skill.id,
      title: "Learning request fixture",
      description: "A sufficient fixture description",
      learningGoal: "A sufficient learning goal",
      currentLevel: "BEGINNER",
      status: "OPEN",
      publishedAt: new Date(),
      expiresAt: new Date(Date.now() + 86400000),
    },
  });
  const proposal = await f.db.proposal.create({
    data: {
      sourceType: "LEARNING_REQUEST",
      requestId: request.id,
      proposerId: a.user.id,
      recipientId: b.user.id,
      skillId: skill.id,
      message: "Fixture direct proposal",
      status: "ACCEPTED",
      expiresAt: new Date(Date.now() + 86400000),
    },
  });
  const conversation = await f.db.conversation.create({
    data: {
      proposalId: proposal.id,
      requestId: request.id,
      participantAId: a.user.id,
      participantBId: b.user.id,
    },
  });
  await f.transactions.run(seedPathFeePolicies);
  const policy = await f.db.feePolicyVersion.findFirstOrThrow({
    where: { policyCode: exchangeType, status: "APPROVED" },
  });
  const path = await f.db.learningPath.create({
    data: {
      conversationId: conversation.id,
      participantAId: a.user.id,
      participantBId: b.user.id,
      currentVersion: 1,
      lockedVersion: 1,
      status: "ACTIVE",
    },
  });
  const agreement = {
    exchangeType,
    totalCreditPerUser: exchangeType === "TWO_WAY" ? amount : null,
    negotiatedCredit: exchangeType === "ONE_WAY" ? amount : null,
    teacherId: exchangeType === "ONE_WAY" ? a.user.id : null,
    learnerId: exchangeType === "ONE_WAY" ? b.user.id : null,
  };
  await f.db.learningPathVersion.create({
    data: {
      pathId: path.id,
      versionNo: 1,
      ...agreement,
      feePolicyId: policy.id,
      feeRateSnapshot: "0.04",
      createdByUserId: a.user.id,
    },
  });
  return {
    path,
    input: {
      pathId: path.id,
      pathVersion: 1,
      participantAId: a.user.id,
      participantBId: b.user.id,
      ...agreement,
    },
  };
}
async function fund(f, account) {
  const payment = await f.order(account);
  await f.receipts.webhook(await f.webhook(payment));
}
async function balanced(f, account) {
  const wallet = await f.db.creditWallet.findUniqueOrThrow({
    where: { userId: account.user.id },
  });
  await f.transactions.run((tx) => f.provenance.requireTracked(tx, wallet));
  return wallet;
}
test("purchased top-ups remain source-aware through real PostgreSQL Hold/settlement", async (t) => {
  const f = await createPaymentFixture(),
    ledger = new CreditLedgerService();
  try {
    await t.test(
      "ONE_WAY consumes purchased lots and creates an earned lot for the teacher",
      async () => {
        const teacher = await f.account(),
          learner = await f.account();
        await fund(f, learner);
        await f.transactions.run((tx) =>
          f.credit.lockWallet(tx, teacher.user.id),
        );
        const { path, input } = await pathFixture(
          f,
          teacher,
          learner,
          "ONE_WAY",
          10000n,
        );
        await f.transactions.run((tx) => ledger.holdPath(tx, input));
        assert.equal((await balanced(f, learner)).heldCredit, 10000n);
        const settled = await f.transactions.run((tx) =>
          ledger.settlePath(tx, {
            pathId: path.id,
            pathVersion: 1,
            exchangeType: "ONE_WAY",
            now: new Date(),
          }),
        );
        assert.equal(settled.fee, 400n);
        const paid = await balanced(f, learner),
          earned = await balanced(f, teacher);
        assert.equal(paid.availableCredit, 0n);
        assert.equal(paid.purchasedCredit, 0n);
        assert.equal(paid.heldCredit, 0n);
        assert.equal(earned.availableCredit, 9600n);
        assert.equal(earned.purchasedCredit, 0n);
        assert.equal(
          (
            await f.db.creditLot.findFirstOrThrow({
              where: { userId: teacher.user.id },
            })
          ).source,
          "EARNED",
        );
        const replay = await f.transactions.run((tx) =>
          ledger.settlePath(tx, {
            pathId: path.id,
            pathVersion: 1,
            exchangeType: "ONE_WAY",
            now: new Date(),
          }),
        );
        assert.equal(replay.operationId, settled.operationId);
        assert.equal((await balanced(f, teacher)).availableCredit, 9600n);
      },
    );
    await t.test(
      "BONUS-first allocation returns original purchased sources after TWO_WAY fee consumption",
      async () => {
        const a = await f.account(),
          b = await f.account();
        await fund(f, a);
        await fund(f, b);
        // Fixture issuance of a bonus source tests allocation; no public bonus program is enabled.
        await f.transactions.run(async (tx) => {
          const wallet = await f.credit.lockWallet(tx, a.user.id);
          const op = await tx.creditOperation.create({
            data: {
              operationType: "TEST_BONUS",
              referenceType: "SYSTEM",
              referenceId: randomUUID(),
              idempotencyKey: randomUUID(),
              status: "SUCCESS",
            },
          });
          await tx.creditLot.create({
            data: {
              userId: a.user.id,
              operationId: op.id,
              source: "BONUS",
              granted: 1000n,
              available: 1000n,
            },
          });
          await tx.creditWallet.update({
            where: { userId: a.user.id },
            data: {
              availableCredit: { increment: 1000n },
              bonusCredit: { increment: 1000n },
            },
          });
          await tx.creditTransaction.create({
            data: {
              userId: a.user.id,
              operationId: op.id,
              entryNo: 1,
              type: "TOP_UP",
              amount: 1000n,
              availableDelta: 1000n,
              heldDelta: 0n,
              availableAfter: wallet.availableCredit + 1000n,
              heldAfter: wallet.heldCredit,
              status: "SUCCESS",
              idempotencyKey: randomUUID(),
            },
          });
        });
        const { path, input } = await pathFixture(f, a, b, "TWO_WAY", 2000n);
        await f.transactions.run((tx) => ledger.holdPath(tx, input));
        const bonus = await f.db.creditLot.findFirstOrThrow({
          where: { userId: a.user.id, source: "BONUS" },
        });
        assert.equal(bonus.available, 0n);
        assert.equal(bonus.held, 1000n);
        await f.transactions.run((tx) =>
          ledger.settlePath(tx, {
            pathId: path.id,
            pathVersion: 1,
            exchangeType: "TWO_WAY",
            now: new Date(),
          }),
        );
        const wallet = await balanced(f, a);
        assert.equal(wallet.availableCredit, 10920n);
        assert.equal(wallet.bonusCredit, 920n);
        assert.equal(wallet.purchasedCredit, 10000n);
        assert.equal((await balanced(f, b)).purchasedCredit, 9920n);
        assert.equal(
          await f.db.creditLotHold.count({ where: { remaining: { gt: 0n } } }),
          0,
        );
      },
    );
  } finally {
    await f.dispose();
  }
});
