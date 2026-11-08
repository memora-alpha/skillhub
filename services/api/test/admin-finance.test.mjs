import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  financeCursor,
  financeScope,
  adminTimeRange,
  requireFinanceAdmin,
} from "../dist/shared/http/admin-finance-page.js";
import {
  AdminCreditReader,
  adminLedgerView,
} from "../dist/modules/credit/application/services/admin-credit.reader.js";
import {
  AdminPaymentsReader,
  adminPaymentView,
} from "../dist/modules/payments/application/services/admin-payments.reader.js";
const actor = {
  userId: "11111111-1111-4111-8111-111111111111",
  roles: ["ADMIN"],
  permissions: ["credit:read:any"],
};
const id = "22222222-2222-4222-8222-222222222222";
test("admin cursors are signed and bound to viewer, kind and normalized filters", () => {
  const scope = financeScope(actor.userId, "ledger", {
    type: "HOLD",
    limit: 20,
  });
  assert.equal(
    scope,
    financeScope(actor.userId, "ledger", { limit: 20, type: "HOLD" }),
  );
  const codec = financeCursor("secret", scope);
  const token = codec.encode({
    id,
    createdAt: new Date("2026-11-08T00:00:00Z"),
  });
  assert.equal(codec.decode(token).id, id);
  assert.throws(
    () => financeCursor("other", scope).decode(token),
    /INVALID_ADMIN_FINANCE_CURSOR/,
  );
  assert.throws(
    () => financeCursor("secret", "another-viewer").decode(token),
    /INVALID_ADMIN_FINANCE_CURSOR/,
  );
  assert.throws(() => codec.decode("bad"), /INVALID_ADMIN_FINANCE_CURSOR/);
  assert.throws(
    () => adminTimeRange("2026-11-09T00:00:00Z", "2026-11-08T00:00:00Z"),
    /INVALID_ADMIN_FINANCE_RANGE/,
  );
});
test("STAFF with permission and ADMIN without permission both fail", () => {
  assert.throws(() =>
    requireFinanceAdmin({ ...actor, roles: ["STAFF"] }, "credit:read:any"),
  );
  assert.throws(() =>
    requireFinanceAdmin({ ...actor, permissions: [] }, "credit:read:any"),
  );
});
test("ledger read enforces read-only transaction and live authorization before repository access", async () => {
  const calls = [];
  const tx = {
    $executeRaw: async () => calls.push("readonly"),
    creditTransaction: {
      findMany: async () => {
        calls.push("ledger");
        return [];
      },
    },
  };
  const reader = new AdminCreditReader(
    { run: async (work) => work(tx) },
    {
      assertLive: async () => {
        calls.push("authorize");
        return actor;
      },
    },
    { jwtKey: "secret" },
  );
  assert.equal((await reader.list(actor, { limit: 20 })).data.length, 0);
  assert.deepEqual(calls, ["readonly", "authorize", "ledger"]);
  const denied = new AdminCreditReader(
    { run: async (work) => work(tx) },
    { assertLive: async () => ({ ...actor, roles: ["STAFF"] }) },
    { jwtKey: "secret" },
  );
  await assert.rejects(
    denied.list(actor, { limit: 20 }),
    /ADMIN_FINANCE_PERMISSION_REQUIRED/,
  );
  assert.equal(calls.filter((c) => c === "ledger").length, 1);
});
test("Credit and VND retain exact serialization beyond JavaScript safe integers", () => {
  const view = adminLedgerView({
    amount: 900719925474099301n,
    availableDelta: -100n,
    heldDelta: 0n,
    availableAfter: 900719925474099301n,
    heldAfter: 0n,
  });
  assert.equal(view.amount, "9007199254740993.01");
  assert.equal(view.availableDelta, "-1.00");
  const payment = adminPaymentView({
    creditAmount: 100n,
    paymentAmountVnd: 900719925474099301n,
    payosCheckout: null,
  });
  assert.equal(payment.paymentAmountVnd, "900719925474099301");
  assert.equal(payment.creditAmount, "1.00");
});
test("reconciliation cannot run with read permission alone and never enables provider lookup", async () => {
  let consulted = false;
  const tx = {
    $executeRaw: async () => {},
    payment: { findUnique: async () => ({ id }) },
  };
  let live = actor;
  const reader = new AdminPaymentsReader(
    { run: async (work) => work(tx) },
    { assertLive: async () => live },
    {},
    {
      report: async (query, lookup) => {
        consulted = true;
        assert.equal(query.paymentId, id);
        assert.equal(lookup, false);
        return { records: [{ paymentLinkId: "private", paymentId: id }] };
      },
    },
  );
  await assert.rejects(reader.report(actor, id));
  assert.equal(consulted, false);
  live = { ...actor, permissions: ["payment:reconcile"] };
  const result = await reader.report(actor, id);
  assert.equal("paymentLinkId" in result.records[0], false);
});
