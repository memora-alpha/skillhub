import assert from "node:assert/strict";
import test from "node:test";
import {
  validateTopUp,
  reviewTopUp,
} from "../src/features/wallet/utils/topup-policy";
import { createPaymentPreparation } from "../src/features/wallet/utils/payment-intent";
import type {
  ModelDispatch,
  PaymentIntent,
} from "../src/features/wallet/types/payment";

const scope = { ownerId: "synthetic-owner-a", generation: 1 };
const setup = () => createPaymentPreparation({ scope, isCurrent: () => true });
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};
const receipt = (intent: PaymentIntent) => ({
  kind: "created" as const,
  intentId: intent.localId,
  scope: intent.scope,
  review: intent.review,
  paymentId: "synthetic-payment-only",
});
function reviewed(model = setup(), amount = "1000") {
  model.edit(amount);
  model.review();
  return model;
}

test("approved exact policy rejects noncanonical/unsafe/off-step input without rounding", () => {
  for (const [amount, credit] of [
    ["1000", "1.00"],
    ["2000000", "2000.00"],
    ["123000", "123.00"],
  ]) {
    const result = validateTopUp(amount!);
    assert.equal(result.amountVnd, amount);
    assert.equal(result.estimatedCredit, credit);
    assert.equal(result.provenance, "estimate");
    assert.equal("expiresAt" in result, false);
  }
  for (const amount of [
    "",
    "0",
    "999",
    "1001",
    "2001000",
    "01000",
    "1.000",
    "1000.00",
    "1e3",
    "+1000",
    "-1000",
    " 1000",
    "1000\n",
    "١٠٠٠",
    "9".repeat(1000),
  ])
    assert.throws(() => validateTopUp(amount));
});

test("review is immutable; changed confirmed-model quote requires explicit re-review, never local TTL", () => {
  const model = reviewed();
  const first = model.getSnapshot().review!;
  assert(Object.isFrozen(first));
  assert.equal(first.provenance, "estimate");
  const quote = {
    quoteId: "synthetic-quote",
    amountVnd: "1000",
    credit: "1.00",
    policyVersion: "2026-10-15-v1",
    expiresAt: "2030-01-01T00:00:00.000Z",
  };
  model.setQuoteModel(quote);
  assert.equal(model.getSnapshot().stage, "DRAFT");
  model.review();
  const confirmed = model.getSnapshot().review!;
  assert.equal(confirmed.provenance, "confirmed-model");
  assert.equal(confirmed.quote?.expiresAt, quote.expiresAt);
  quote.expiresAt = "2031-01-01T00:00:00.000Z";
  assert.equal(confirmed.quote?.expiresAt, "2030-01-01T00:00:00.000Z");
  model.setQuoteModel(quote);
  assert.equal(model.getSnapshot().review, undefined);
  assert.throws(() => reviewTopUp("1000", { ...quote, credit: "2.00" }));
  assert.throws(() => reviewTopUp("2000", quote));
  assert.throws(() =>
    reviewTopUp("1000", { ...quote, policyVersion: "unapproved" }),
  );
  assert.throws(() => reviewTopUp("1000", { ...quote, expiresAt: "invalid" }));
});

test("no explicit review means zero identities/dispatches; invalid draft/error and Back preserve text", async () => {
  const model = setup();
  let calls = 0;
  const dispatch: ModelDispatch = async (intent) => {
    calls++;
    return receipt(intent);
  };
  await model.confirmModel(dispatch);
  model.edit("1001");
  assert.equal(model.review(), false);
  await model.confirmModel(dispatch);
  assert.equal(model.getSnapshot().draft.amountText, "1001");
  assert(model.getSnapshot().error);
  assert.equal(calls, 0);
  assert.equal(model.getSnapshot().intent, undefined);
  model.edit("1000");
  model.review();
  model.backToDraft();
  assert.equal(model.getSnapshot().draft.amountText, "1000");
  assert.equal(model.getSnapshot().intent, undefined);
});

test("synchronous claim precedes await and reentrant/multiple callers; frozen submitted snapshot survives edits", async () => {
  const model = reviewed();
  const gate = deferred<unknown>();
  let calls = 0;
  let submitted!: PaymentIntent;
  const dispatch: ModelDispatch = (intent, options) => {
    calls++;
    submitted = intent;
    assert.equal(model.getSnapshot().stage, "CREATING");
    assert(Object.isFrozen(intent));
    assert(Object.isFrozen(intent.scope));
    assert(Object.isFrozen(intent.review));
    assert.equal(options.retry, false);
    assert.equal(options.replayAfterRenewal, false);
    void model.confirmModel(dispatch);
    return gate.promise;
  };
  const first = model.confirmModel(dispatch);
  const second = model.confirmModel(dispatch);
  model.edit("2000");
  assert.equal(calls, 1);
  assert.equal(model.getSnapshot().draft.amountText, "1000");
  assert.equal(submitted.review.amountVnd, "1000");
  gate.resolve(receipt(submitted));
  await Promise.all([first, second]);
  assert.equal(model.getSnapshot().stage, "CREATED_WITH_ID");
  assert.equal(model.getSnapshot().paymentId, "synthetic-payment-only");
  assert.equal("state" in model.getSnapshot(), false);
});

test("timeout/disconnect/abort/malformed and mismatched receipt stay unknown without a fresh identity", async () => {
  const failures: ModelDispatch[] = [
    async () => {
      throw new Error("timeout");
    },
    async () => {
      throw new DOMException("aborted", "AbortError");
    },
    async () => ({}),
    async (i) => ({ ...receipt(i), paymentId: "" }),
    async (i) => ({ ...receipt(i), scope: { ...scope, ownerId: "b" } }),
    async (i) => ({ ...receipt(i), intentId: "different" }),
    async (i) => ({ ...receipt(i), review: reviewTopUp("2000") }),
  ];
  for (const dispatch of failures) {
    const model = reviewed();
    await model.confirmModel(dispatch);
    const intent = model.getSnapshot().intent;
    assert.equal(model.getSnapshot().stage, "UNKNOWN_OUTCOME");
    let calls = 0;
    model.startNext();
    model.edit("2000");
    model.review();
    model.backToDraft();
    await model.confirmModel(async () => {
      calls++;
      return {};
    });
    assert.equal(calls, 0);
    assert.equal(model.getSnapshot().intent, intent);
    assert.equal(model.getSnapshot().draft.amountText, "1000");
    assert.equal(model.getSnapshot().stage, "UNKNOWN_OUTCOME");
  }
});

test("interrupt retains unknown and ignores an eventual ID, even if AbortSignal is ignored", async () => {
  const model = reviewed(),
    gate = deferred<unknown>();
  let intent!: PaymentIntent;
  let signal!: AbortSignal;
  const pending = model.confirmModel((i, o) => {
    intent = i;
    signal = o.signal;
    return gate.promise;
  });
  model.interrupt();
  assert.equal(signal.aborted, true);
  assert.equal(model.getSnapshot().stage, "UNKNOWN_OUTCOME");
  gate.resolve(receipt(intent));
  await pending;
  assert.equal(model.getSnapshot().stage, "UNKNOWN_OUTCOME");
  assert.equal(model.getSnapshot().paymentId, undefined);
});

test("synchronous session cleanup during claim notification prevents dispatch entirely", async () => {
  const model = reviewed();
  let calls = 0;
  model.subscribe(() => {
    if (model.getSnapshot().stage === "CREATING") model.dispose();
  });
  await model.confirmModel(async (i) => {
    calls++;
    return receipt(i);
  });
  assert.equal(calls, 0);
  assert.equal(model.getSnapshot().stage, "SESSION_ENDED");
});

test("only injected associated proven-no-creation permits correction; known identity permits deliberate next intent without a pending ban", async () => {
  const model = reviewed();
  await model.confirmModel(async (i) => ({
    kind: "rejected-with-no-creation",
    intentId: i.localId,
    scope: i.scope,
    review: i.review,
  }));
  assert.equal(model.getSnapshot().stage, "REJECTED_WITH_NO_CREATION");
  assert.equal(model.getSnapshot().draft.amountText, "1000");
  model.startNext();
  model.edit("2000");
  model.review();
  await model.confirmModel(async (i) => receipt(i));
  const known = model.getSnapshot().intent!;
  model.backToDraft();
  assert.equal(model.getSnapshot().paymentId, "synthetic-payment-only");
  model.startNext();
  model.review();
  await model.confirmModel(async (i) => {
    assert.notEqual(i.localId, known.localId);
    return receipt(i);
  });
  assert.equal(model.getSnapshot().stage, "CREATED_WITH_ID");
});
