import assert from "node:assert/strict";
import { test } from "node:test";
import { TransactionRunner } from "../dist/infrastructure/database/transaction-runner.js";
import { isRetryableDatabaseConflict } from "../dist/infrastructure/database/transaction-errors.js";

test("transaction runner supplies one transaction and rolls errors through", async () => {
  const tx = { marker: Symbol("tx") };
  const calls = [];
  const prisma = {
    $transaction: async (work, options) => {
      calls.push(options);
      return work(tx);
    },
  };
  const runner = new TransactionRunner(prisma, async () => {});
  assert.equal(await runner.run(async (context) => context), tx);
  assert.deepEqual(calls[0], {
    isolationLevel: "Serializable",
    maxWait: 2000,
    timeout: 5000,
  });
  const failure = new Error("validation");
  await assert.rejects(
    runner.run(async () => {
      throw failure;
    }),
    (error) => error === failure,
  );
  assert.equal(calls.length, 2);
});

test("only database conflicts get a bounded retry", async () => {
  let attempts = 0;
  const prisma = {
    $transaction: async (work) => {
      attempts++;
      if (attempts < 3) throw { code: "P2034" };
      return work({});
    },
  };
  const runner = new TransactionRunner(prisma, async () => {});
  assert.equal(await runner.run(async () => "done"), "done");
  assert.equal(attempts, 3);
  assert.equal(isRetryableDatabaseConflict({ code: "P2002" }), false);
  assert.equal(isRetryableDatabaseConflict({ code: "P2034" }), true);
  assert.equal(isRetryableDatabaseConflict({ cause: { code: "40P01" } }), true);
  assert.equal(isRetryableDatabaseConflict({ code: "ECONNRESET" }), false);
});

// Sanitized shapes captured from adapter-pg 7.8.0 on PostgreSQL 17 (2026-10-05).
test("real adapter-pg conflict shapes are retryable; other driver errors are not", () => {
  const writeConflict = {
    originalCode: "40001",
    kind: "TransactionWriteConflict",
  };
  const deadlock = {
    originalCode: "40P01",
    kind: "postgres",
    code: "40P01",
    severity: "ERROR",
  };
  const adapterError = (cause) => ({ name: "DriverAdapterError", cause });
  const wrapped = (code, cause) => ({
    name: "PrismaClientKnownRequestError",
    code,
    meta: { driverAdapterError: adapterError(cause) },
  });
  for (const error of [
    adapterError(writeConflict),
    adapterError(deadlock),
    wrapped("P2034", writeConflict),
    wrapped("P2010", writeConflict),
    wrapped("P2010", deadlock),
  ])
    assert.equal(
      isRetryableDatabaseConflict(error),
      true,
      JSON.stringify(error),
    );

  const uniqueViolation = {
    originalCode: "23505",
    kind: "UniqueConstraintViolation",
  };
  for (const error of [
    adapterError(uniqueViolation),
    wrapped("P2010", uniqueViolation),
    wrapped("P2010", {
      originalCode: "42501",
      kind: "postgres",
      code: "42501",
    }),
    { name: "PrismaClientKnownRequestError", code: "P2010", meta: {} },
  ])
    assert.equal(
      isRetryableDatabaseConflict(error),
      false,
      JSON.stringify(error),
    );
});
