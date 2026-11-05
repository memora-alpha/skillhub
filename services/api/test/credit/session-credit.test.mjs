import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createSessionCreditSnapshot,
  calculateSessionCredit,
} from "../../dist/modules/credit/domain/session-credit.js";

const twoWay = {
  exchangeType: "TWO_WAY",
  participantAId: "a",
  participantBId: "b",
  teacherId: null,
  learnerId: null,
};
const oneWay = {
  ...twoWay,
  exchangeType: "ONE_WAY",
  teacherId: "a",
  learnerId: "b",
};
const makeSessions = (a, b = 0) => [
  ...Array.from({ length: a }, (_, i) => ({
    id: `a${i}`,
    planId: "ab",
    planVersion: 1,
    outlineSessionNo: i + 1,
    teacherId: "a",
    learnerId: "b",
  })),
  ...Array.from({ length: b }, (_, i) => ({
    id: `b${i}`,
    planId: "ba",
    planVersion: 1,
    outlineSessionNo: i + 1,
    teacherId: "b",
    learnerId: "a",
  })),
];

test("ONE_WAY freezes exact per-session shares; the first original sessions receive remainder units", () => {
  const rows = makeSessions(3);
  const snapshot = createSessionCreditSnapshot(
    10000n,
    oneWay,
    [...rows].reverse(),
  );
  assert.deepEqual(
    snapshot.sessions.map((row) => row.creditUnits),
    ["3334", "3333", "3333"],
  );
  const result = calculateSessionCredit(
    snapshot,
    10000n,
    oneWay,
    rows.map((row, i) => ({
      ...row,
      status: i === 0 ? "COMPLETED" : "CONFIRMED",
    })),
  );
  assert.equal(result.completedCredit, 3334n);
  assert.equal(result.platformFee, 133n);
  assert.equal(result.uncompletedCredit, 6666n);
  assert.equal(
    result.completedCredit -
      result.platformFee +
      result.platformFee +
      result.uncompletedCredit,
    10000n,
  );
});

test("TWO_WAY denominator spans unequal directions; teaching imbalance never infers compensation", () => {
  const rows = makeSessions(5, 3);
  const snapshot = createSessionCreditSnapshot(10000n, twoWay, rows);
  const result = calculateSessionCredit(
    snapshot,
    10000n,
    twoWay,
    rows.map((row) => ({
      ...row,
      status: row.teacherId === "a" ? "COMPLETED" : "CONFIRMED",
    })),
  );
  assert.equal(result.completedCredit, 6250n);
  assert.equal(result.platformFee, 250n);
  assert.equal(result.refundBeforeCompensation, 9750n);
});

test("makeup keeps the same original share; only a completed occurrence counts", () => {
  const rows = makeSessions(2, 2);
  const snapshot = createSessionCreditSnapshot(2001n, twoWay, rows);
  const live = rows.map((row) => ({ ...row, status: "MAKEUP_REQUIRED" }));
  assert.equal(
    calculateSessionCredit(snapshot, 2001n, twoWay, live).completedCredit,
    0n,
  );
  live[0].status = "COMPLETED";
  assert.equal(
    calculateSessionCredit(snapshot, 2001n, twoWay, live).completedCredit,
    501n,
  );
  assert.equal(
    calculateSessionCredit(snapshot, 2001n, twoWay, live).completedCredit,
    501n,
  );
});

test("legacy, changed identities, missing original sessions and altered monetary policy cannot be quoted", () => {
  const rows = makeSessions(1, 1);
  const snapshot = createSessionCreditSnapshot(2000n, twoWay, rows);
  const live = rows.map((row) => ({ ...row, status: "CONFIRMED" }));
  const calculate = (value, current = live) =>
    calculateSessionCredit(value, 2000n, twoWay, current);
  assert.throws(() => calculate(null), /SESSION_CREDIT_SNAPSHOT_MISSING/);
  assert.throws(
    () => calculate({ ...snapshot, feeBps: 500 }),
    /SESSION_CREDIT_SNAPSHOT_INVALID/,
  );
  assert.throws(
    () =>
      calculate({
        ...snapshot,
        sessions: snapshot.sessions.map((row) => ({
          ...row,
          creditUnits: "999",
        })),
      }),
    /SESSION_CREDIT_SNAPSHOT_INVALID/,
  );
  assert.throws(
    () => calculate(snapshot, live.slice(1)),
    /SESSION_CREDIT_SNAPSHOT_MISMATCH/,
  );
  assert.throws(
    () =>
      calculate(
        snapshot,
        live.map((row) => ({ ...row, planVersion: 2 })),
      ),
    /SESSION_CREDIT_SNAPSHOT_MISMATCH/,
  );
});

test("Hold snapshots reject a teacher outside the agreement participants", () => {
  assert.throws(
    () =>
      createSessionCreditSnapshot(
        2000n,
        { ...oneWay, teacherId: "outsider" },
        makeSessions(1).map((row) => ({ ...row, teacherId: "outsider" })),
      ),
    /SESSION_CREDIT_SNAPSHOT_INVALID/,
  );
});

test("exhaustive small-unit splits conserve Credit and aggregate fees once", () => {
  for (let n = 1; n <= 12; n++) {
    const rows = makeSessions(n);
    for (let total = 1n; total <= 150n; total++) {
      const snapshot = createSessionCreditSnapshot(total, oneWay, rows);
      assert.equal(
        snapshot.sessions.reduce(
          (sum, row) => sum + BigInt(row.creditUnits),
          0n,
        ),
        total,
      );
      for (const completed of [0, Math.floor(n / 2), n]) {
        const result = calculateSessionCredit(
          snapshot,
          total,
          oneWay,
          rows.map((row, i) => ({
            ...row,
            status: i < completed ? "COMPLETED" : "CONFIRMED",
          })),
        );
        assert.equal(result.uncompletedCredit + result.completedCredit, total);
        assert.equal(result.platformFee, (result.completedCredit * 4n) / 100n);
        assert.ok(result.refundBeforeCompensation >= 0n);
      }
    }
  }
});
