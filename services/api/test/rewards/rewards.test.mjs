import assert from "node:assert/strict";
import { test } from "node:test";
import { randomBytes } from "node:crypto";
import {
  assertTransition,
  assertWithinLimits,
  nextCheckDelayMs,
} from "../../dist/modules/rewards/domain/redemption.policy.js";
import { VoucherSecretCipher } from "../../dist/modules/rewards/application/services/voucher-secret.cipher.js";
import { MockVoucherProvider } from "../../dist/modules/rewards/infrastructure/providers/mock-voucher.provider.js";
import { VoucherProviderError } from "../../dist/modules/rewards/application/contracts/voucher-provider.js";
import { RedemptionService } from "../../dist/modules/rewards/application/services/redemption.service.js";
import { vietnamDayStart } from "../../dist/modules/rewards/application/services/reward-support.js";
import { validateEnvironment } from "../../dist/configs/environment.js";

const key = randomBytes(32).toString("base64");
const config = (values) => ({ get: (name) => values[name] });

test("state machine allows only the documented transitions", () => {
  assertTransition("ISSUING", "ISSUED");
  assertTransition("ISSUING", "FAILED_REFUNDED");
  assertTransition("ISSUING", "MANUAL_REVIEW");
  assertTransition("MANUAL_REVIEW", "REFUNDED_MANUAL");
  for (const [from, to] of [
    ["ISSUED", "FAILED_REFUNDED"],
    ["FAILED_REFUNDED", "ISSUED"],
    ["ISSUING", "REFUNDED_MANUAL"],
    ["REFUNDED_MANUAL", "ISSUED"],
  ])
    assert.throws(
      () => assertTransition(from, to),
      /VOUCHER_INVALID_TRANSITION/,
    );
});

test("limits are checked in hundredths of Credit and in VND", () => {
  const limits = {
    userDailyLimitCredit: 500n,
    platformDailyBudgetVnd: 1_000_000n,
  };
  const base = {
    limits,
    priceCredit: 5000n,
    faceValueVnd: 50_000n,
    userSpentToday: 45_000n,
    platformIssuedVndToday: 0n,
  };
  assertWithinLimits(base); // 450 + 50 Credit == 500 limit
  assert.throws(
    () => assertWithinLimits({ ...base, userSpentToday: 45_001n }),
    /VOUCHER_USER_LIMIT_EXCEEDED/,
  );
  assert.throws(
    () => assertWithinLimits({ ...base, platformIssuedVndToday: 950_001n }),
    /VOUCHER_BUDGET_EXCEEDED/,
  );
});

test("reconcile backoff doubles and caps at 30 minutes", () => {
  assert.deepEqual(
    [0, 1, 2, 3, 10].map((attempts) => nextCheckDelayMs(attempts) / 60_000),
    [1, 2, 4, 8, 30],
  );
});

test("Vietnam day starts at 17:00 UTC of the previous day", () => {
  assert.equal(
    vietnamDayStart(new Date("2026-11-20T03:00:00Z")).toISOString(),
    "2026-11-19T17:00:00.000Z",
  );
  assert.equal(
    vietnamDayStart(new Date("2026-11-20T18:00:00Z")).toISOString(),
    "2026-11-20T17:00:00.000Z",
  );
});

test("secret cipher round-trips and binds the redemption ID", () => {
  const cipher = new VoucherSecretCipher(config({ VOUCHER_SECRET_KEY: key }));
  const secret = { code: "DEMO-AAAA-BBBB", pin: null, link: null };
  const sealed = cipher.seal("r1", secret);
  assert.deepEqual(cipher.open("r1", sealed), secret);
  assert.throws(() => cipher.open("r2", sealed));
  assert.throws(
    () => new VoucherSecretCipher(config({})).seal("r1", secret),
    /VOUCHER_SECRET_KEY/,
  );
});

test("mock provider scenarios", async () => {
  const provider = new MockVoucherProvider();
  const call = (suffix, ref) =>
    provider.issue({
      clientRef: ref,
      providerProductId: suffix,
      faceValueVnd: 1n,
    });
  const ok = await call("coffee-50k-ok", "a");
  assert.match(ok.code, /^DEMO-[0-9A-F]{4}-[0-9A-F]{4}$/);
  assert.equal((await call("coffee-50k-ok", "a")).code, ok.code); // idempotent per ref
  await assert.rejects(
    call("mart-oos", "b"),
    (e) => e.kind === "DEFINITIVE" && e.code === "OUT_OF_STOCK",
  );
  await assert.rejects(call("ride-err", "c"), (e) => e.kind === "DEFINITIVE");
  await assert.rejects(call("books-lost", "d"), (e) => e.kind === "UNKNOWN");
  assert.equal(await provider.findByClientRef("d"), null);
  await assert.rejects(
    call("coffee-timeout", "e"),
    (e) => e.kind === "UNKNOWN",
  );
  assert.ok(await provider.findByClientRef("e")); // provider did process it
  assert.ok(await call("coffee-timeout", "e")); // retry returns the stored voucher
});

test("environment refuses the mock provider in production and requires a key", () => {
  const base = {
    DATABASE_URL: "postgresql://u:p@h/db?sslmode=verify-full",
    MONGODB_URI: "mongodb://h/db?tls=true",
    REDIS_URL: "rediss://h:6379",
    CORS_ORIGIN: "https://app.example.com",
    NODE_ENV: "development",
    APP_DEPLOYMENT_TIER: "staging",
    VOUCHER_REDEMPTION_ENABLED: "true",
    VOUCHER_PROVIDER: "mock",
    VOUCHER_SECRET_KEY: key,
  };
  const failing = (extra) => {
    try {
      validateEnvironment({ ...base, ...extra });
    } catch (error) {
      return error.message;
    }
    return "";
  };
  assert.doesNotMatch(failing({}), /VOUCHER/);
  assert.match(failing({ VOUCHER_SECRET_KEY: "short" }), /VOUCHER_SECRET_KEY/);
  assert.match(
    failing({ APP_DEPLOYMENT_TIER: "production" }),
    /VOUCHER_PROVIDER/,
  );
  assert.doesNotMatch(
    failing({ VOUCHER_REDEMPTION_ENABLED: "false", VOUCHER_SECRET_KEY: "" }),
    /VOUCHER/,
  );
});

/** In-memory fakes for the orchestration paths that never touch SQL operators. */
function harness({ status = "ISSUING", attempts = 0, maxAttempts = 3 } = {}) {
  const row = {
    id: "r1",
    userId: "u1",
    status,
    attempts,
    priceCredit: 5000n,
    faceValueVnd: 50_000n,
    product: {
      providerProductId: "coffee-50k-ok",
      displayNameOverride: null,
      nameVi: "Demo",
      imageOverride: null,
      imageUrl: null,
      termsVi: null,
      brand: { nameVi: "Demo Coffee", logoUrl: null },
    },
  };
  const calls = { refunds: 0, vouchers: 0 };
  const tx = {
    $queryRaw: async () => [],
    voucherRedemption: {
      findUniqueOrThrow: async () => row,
      update: async ({ data }) => Object.assign(row, data),
    },
    issuedVoucher: { create: async () => void (calls.vouchers += 1) },
  };
  const transactions = { run: (work) => work(tx) };
  const credit = {
    refundVoucher: async () => {
      calls.refunds += 1;
      return { operationId: "op-refund" };
    },
  };
  const provider = new MockVoucherProvider();
  const service = new RedemptionService(
    { voucherRedemption: { findUnique: async () => row } },
    transactions,
    {},
    credit,
    {},
    provider,
    new VoucherSecretCipher(config({ VOUCHER_SECRET_KEY: key })),
    {
      getSnapshot: async () => ({
        values: { "voucher.reconcileMaxAttempts": maxAttempts },
      }),
    },
    config({}),
  );
  return { row, calls, service, provider };
}

test("a DEFINITIVE failure refunds exactly once", async () => {
  const { row, calls, service } = harness();
  await service.failDefinitive("r1", "OUT_OF_STOCK");
  await service.failDefinitive("r1", "OUT_OF_STOCK");
  assert.equal(row.status, "FAILED_REFUNDED");
  assert.equal(row.refundOperationId, "op-refund");
  assert.equal(calls.refunds, 1);
});

test("an UNKNOWN outcome keeps the debit and escalates to MANUAL_REVIEW without refund", async () => {
  const { row, calls, service } = harness({ attempts: 1, maxAttempts: 3 });
  await service.recordUnknown("r1", "PROVIDER_TIMEOUT");
  assert.equal(row.status, "ISSUING");
  assert.equal(row.attempts, 2);
  assert.ok(row.nextCheckAt > new Date());
  await service.recordUnknown("r1", "PROVIDER_TIMEOUT");
  assert.equal(row.status, "MANUAL_REVIEW");
  assert.equal(row.nextCheckAt, null);
  assert.equal(calls.refunds, 0);
});

test("finalizeIssued stores one voucher and ignores repeats", async () => {
  const { row, calls, service } = harness();
  const data = {
    providerTransactionRef: "p1",
    code: "DEMO-1",
    pin: null,
    link: null,
    expiresAt: null,
  };
  await service.finalizeIssued("r1", data);
  await service.finalizeIssued("r1", data);
  assert.equal(row.status, "ISSUED");
  assert.equal(calls.vouchers, 1);
});

test("reconcile resolves a timed-out issuance without refunding", async () => {
  const { row, calls, service, provider } = harness();
  await assert.rejects(
    provider.issue({
      clientRef: "r1",
      providerProductId: "coffee-timeout",
      faceValueVnd: 1n,
    }),
    VoucherProviderError,
  );
  await service.reconcileOne("r1");
  assert.equal(row.status, "ISSUED");
  assert.equal(calls.refunds, 0);
});
