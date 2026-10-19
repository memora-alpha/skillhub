import assert from "node:assert/strict";
import test from "node:test";
import { parsePayment } from "../src/features/wallet/schemas/payment-contracts";
import {
  createPaymentObservation,
  reducePaymentObservation,
  detachPaymentQr,
} from "../src/features/wallet/utils/payment-observation";
import {
  paymentOutcome,
  paymentState,
} from "../src/features/wallet/utils/payment-outcome";
import { observePaymentModel } from "../src/features/wallet/utils/payment-outcome";
import {
  paymentTarget,
  paymentReceipt,
} from "./fixtures/payment-observation-model";
import {
  paymentWire,
  paymentId,
  otherPaymentId,
  paymentStates,
} from "./fixtures/payment-api";

const scope = { ownerId: "synthetic-owner-a", generation: 1 };
const target = { scope, paymentId };
type Snapshot = ReturnType<typeof createPaymentObservation>;
function apply(
  previous: Snapshot,
  wire: unknown = paymentWire(),
  ticket = 1,
  currentTicket = ticket,
) {
  return reducePaymentObservation(previous, {
    scope,
    paymentId,
    ticket,
    currentTicket,
    data: parsePayment(wire),
  });
}
const initial = () => createPaymentObservation(target);

test("background detaches raw QR without removing suppression latch or accepting conflicting financial state", () => {
  const old = apply(initial());
  const paused = detachPaymentQr(old);
  assert.equal(paused.data?.checkout, null);
  assert(apply(paused, paymentWire(), 2).data?.checkout);
  const hidden = apply(old, { ...paymentWire(), checkout: null }, 2);
  assert.equal(
    apply(detachPaymentQr(hidden), paymentWire(), 3).data?.checkout,
    null,
  );
  const paid = apply(initial(), paymentWire("PAID"));
  const conflict = apply(detachPaymentQr(paid), paymentWire("FAILED"), 2);
  assert.equal(conflict.data?.status, "PAID");
  assert.equal(conflict.stale, true);
});

test("known-ID first observation needs only captured scope/ID, never a US2 intent/amount", () => {
  const state = apply(initial());
  assert.equal(state.data?.id, paymentId);
  assert.equal(state.data?.creditAmount, "123.00");
  assert.equal(state.stale, false);
  assert(Object.isFrozen(state));
  assert(Object.isFrozen(state.target.scope));
  const mutable = { scope: { ...scope }, paymentId };
  const captured = createPaymentObservation(mutable);
  mutable.scope.ownerId = "other";
  assert.equal(captured.target.scope.ownerId, scope.ownerId);
  for (const invalid of [
    { ...target, paymentId: "bad" },
    { ...target, scope: { ...scope, ownerId: "" } },
    { ...target, scope: { ...scope, generation: -1 } },
  ])
    assert.throws(() => createPaymentObservation(invalid));
});
test("scope/target/ticket checks precede version comparison and ignore obsolete outcomes", () => {
  const old = apply(initial());
  const data = parsePayment(paymentWire("PAID", 100));
  const event = { scope, paymentId, ticket: 2, currentTicket: 2, data };
  for (const change of [
    { scope: { ...scope, generation: 2 } },
    { scope: { ...scope, ownerId: "synthetic-owner-b" } },
    { paymentId: otherPaymentId },
    { ticket: 1, currentTicket: 2 },
    { ticket: 0, currentTicket: 0 },
    { ticket: 1.5 },
  ])
    assert.equal(reducePaymentObservation(old, { ...event, ...change }), old);
  const latest = apply(old, paymentWire("PAID", 3), 3);
  assert.equal(apply(latest, paymentWire("PENDING", 200), 2, 3), latest);
  // A caller must supply the active request ticket; no transport/observer here.
});
test("wrong response ID and immutable quote changes never replace accepted data", () => {
  const old = apply(initial());
  for (const change of [
    { id: otherPaymentId },
    { paymentAmountVnd: "124000", creditAmount: "124.00" },
    { gateway: "LEGACY" },
    { createdAt: "2026-10-16T00:00:00Z" },
    { expiresAt: null },
  ]) {
    const changed = apply(old, { ...paymentWire("PAID", 2), ...change });
    assert.equal(changed.data, old.data);
    assert.equal(changed.stale, true);
    assert.equal(changed.issue, "conflict");
  }
  const wrongFirst = apply(initial(), { ...paymentWire(), id: otherPaymentId });
  assert.equal(wrongFirst.data, undefined);
  assert.equal(wrongFirst.issue, "conflict");
});
test("higher version wins, lower is ignored and newer EXPIRED to PAID is legal", () => {
  const expired = apply(initial(), paymentWire("EXPIRED", 4));
  const paid = apply(
    expired,
    { ...paymentWire("PAID", 5), paidAt: "2026-10-17T00:30:00Z" },
    2,
  );
  assert.equal(paid.data?.status, "PAID");
  assert.equal(paid.data?.version, 5);
  assert.equal(apply(paid, paymentWire("EXPIRED", 4), 3), paid);
  // No enum rank: persisted backend corrections can move in any direction.
  assert.equal(apply(paid, paymentWire("REVIEW", 6), 4).data?.status, "REVIEW");
  const ninth = apply(initial(), paymentWire("PENDING", 9));
  const tenth = apply(ninth, paymentWire("PAID", 10), 2);
  assert.equal(tenth.data?.version, 10);
  assert.equal(apply(tenth, paymentWire("PENDING", 9), 3), tenth);
});
test("same-version status/date/descriptor conflicts retain accepted result stale", () => {
  const old = apply(initial());
  for (const incoming of [
    paymentWire("PAID"),
    { ...paymentWire(), paidAt: "2026-10-17T00:30:00Z" },
    {
      ...paymentWire(),
      checkout: {
        ...paymentWire().checkout!,
        qrCode: "DIFFERENT SYNTHETIC TEXT",
      },
    },
  ]) {
    const result = apply(old, incoming, 2);
    assert.equal(result.data?.status, "PENDING");
    assert.equal(result.stale, true);
    assert.equal(result.issue, "conflict");
  }
  const conflict = apply(old, paymentWire("REVIEW"));
  assert.equal(apply(conflict).stale, false);
});
test("equal-version null hides QR; equal/lower late QR cannot restore; valid newer projection can", () => {
  const old = apply(initial(), paymentWire("PENDING", 3));
  const hidden = apply(
    old,
    { ...paymentWire("PENDING", 3), checkout: null },
    2,
  );
  assert.equal(hidden.data?.checkout, null);
  assert.equal(hidden.data?.status, "PENDING");
  assert.equal(hidden.suppressedVersion, 3);
  assert.equal(hidden.stale, false);
  const late = apply(hidden, paymentWire("PENDING", 3), 3);
  assert.equal(late.data?.checkout, null);
  assert.equal(apply(late, paymentWire("PENDING", 2), 4), late);
  assert.equal(apply(hidden, paymentWire("PENDING", 10), 1, 2), hidden);
  const newer = apply(late, paymentWire("PENDING", 4), 5);
  assert(newer.data?.checkout);
  assert.equal(newer.suppressedVersion, undefined);
  const firstNull = apply(initial(), { ...paymentWire(), checkout: null });
  assert.equal(apply(firstNull).data?.checkout, null);
});
test("invalid newer quote cannot reset QR latch; latch is session/payment-local", () => {
  const hidden = apply(apply(initial()), { ...paymentWire(), checkout: null });
  const mismatch = apply(hidden, {
    ...paymentWire("PENDING", 2),
    paymentAmountVnd: "124000",
    creditAmount: "124.00",
  });
  assert.equal(mismatch.suppressedVersion, 1);
  assert.equal(apply(mismatch).data?.checkout, null);
  const other = createPaymentObservation({
    scope: { ...scope, generation: 2 },
    paymentId,
  });
  const accepted = reducePaymentObservation(other, {
    scope: other.target.scope,
    paymentId,
    ticket: 1,
    currentTicket: 1,
    data: parsePayment(paymentWire()),
  });
  assert(accepted.data?.checkout);
});
test("PAID is separate from QR/provider/refresh/clock claims; no client clock transition", () => {
  const pending = apply(initial(), {
    ...paymentWire(),
    expiresAt: "2000-01-01T00:00:00Z",
  });
  assert.equal(pending.data?.status, "PENDING");
  const paid = apply(initial(), paymentWire("PAID"));
  const extra = {
    ...paymentWire("PAID"),
    providerStatus: "FAILED",
    walletRefresh: "error",
    historyRefresh: "error",
    urlState: "FAILED",
  };
  assert.equal(apply(paid, extra).data?.status, "PAID");
  assert.equal("walletRefresh" in paid.data!, false);
});
test("REVIEW/unknown stay neutral and preparation seam retains conservative semantics", () => {
  const labels = new Set(
    paymentStates.map((s) => paymentOutcome(paymentState(s))),
  );
  assert.equal(labels.size, 7);
  assert.equal(paymentState("REVIEW"), "REVIEW");
  assert.match(paymentOutcome("REVIEW"), /kiểm tra|đối soát/);
  for (const raw of ["UNFAMILIAR", "SUCCESS", "paid", "toString", "__proto__"])
    assert.equal(paymentState(raw), "UNKNOWN");
  const unknown = apply(initial(), paymentWire("FUTURE_STATE"));
  assert.equal(paymentState(unknown.data!.status), "UNKNOWN");
  assert.equal(
    observePaymentModel(paymentReceipt("REVIEW"), paymentTarget).state,
    "REVIEW",
  );
});

test("equal-version operational metadata changes/clears without conflict, QR remains suppressed", () => {
  const old = apply(initial());
  const hidden = apply(
    old,
    {
      ...paymentWire(),
      checkout: null,
      recoveryRequired: true,
      recoveryReason: "PAYMENT_CHANNEL_UNAVAILABLE",
    },
    2,
  );
  assert.equal(hidden.stale, false);
  assert.equal(hidden.data?.recoveryRequired, true);
  const clear = apply(hidden, paymentWire(), 3);
  assert.equal(clear.data?.recoveryRequired, false);
  assert.equal(clear.data?.recoveryReason, null);
  assert.equal(clear.data?.checkout, null);
  assert.equal(clear.stale, false);
  assert.equal(
    apply(
      clear,
      { ...paymentWire(), recoveryRequired: true, recoveryReason: "OLD" },
      2,
      3,
    ),
    clear,
  );
  const paid = apply(initial(), paymentWire("PAID"));
  const warning = apply(
    paid,
    {
      ...paymentWire("PAID"),
      recoveryRequired: true,
      recoveryReason: "PAYMENT_CHECKOUT_MISSING",
    },
    2,
  );
  assert.equal(warning.data?.status, "PAID");
  assert.equal(warning.data?.recoveryRequired, true);
});
