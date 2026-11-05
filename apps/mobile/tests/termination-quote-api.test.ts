import assert from "node:assert/strict";
import { test } from "node:test";
import { createPathChangesApi } from "../src/features/learning-paths/api/path-changes-api";
import {
  terminationActions,
  canRequestTermination,
} from "../src/features/learning-paths/utils/termination-policy";
import type { ApiLearningPath } from "../src/features/learning-paths/api/learning-paths-contract";
import { terminationQuoteNotes } from "../src/features/learning-paths/utils/termination-quote-summary";
import {
  terminationFixture,
  terminationQuoteFixture,
} from "./fixtures/path-changes-data";
import { fixtureId } from "./fixtures/learning-requests-data";

test("participant quote uses a read with cancellation signal and exact server amounts", async () => {
  const quote = terminationQuoteFixture();
  quote.allocations[0]!.refund = "9007199254740993.01";
  const signal = new AbortController().signal;
  const api = createPathChangesApi(async (url, options) => {
    assert.equal(
      url,
      `/learning-paths/${quote.pathId}/termination-requests/quote`,
    );
    assert.deepEqual(options, { signal });
    return {
      ...quote,
      lockedVersion: 1,
      executionDigest: "a".repeat(64),
      policyReference: "approved-policy",
      policy: "ONE_WAY_SESSION_V1",
      unresolvedSessionIds: [],
      directions: [],
      allocations: quote.allocations.map((allocation) => ({
        ...allocation,
        remainingHeld: "100.00",
        completedCredit: "40.00",
        uncompletedCredit: "60.00",
        requestedCompensationCredit: "0.00",
        attendance: [],
        sessionCredits: [],
      })),
    };
  });
  assert.deepEqual(await api.quote(quote.pathId, signal), quote);
});
test("quote rejects another path, duplicate owner/allocation and malformed monetary payloads", async () => {
  const quote = terminationQuoteFixture();
  for (const payload of [
    { ...quote, pathId: fixtureId(11) },
    { ...quote, allocations: [quote.allocations[0], quote.allocations[0]] },
    { ...quote, allocations: [{ ...quote.allocations[0], refund: 60 }] },
    {
      ...quote,
      allocations: [{ ...quote.allocations[0], platformFee: "-1.00" }],
    },
    { ...quote, status: "INVALID" },
    { ...quote, completedSessions: "2" },
  ]) {
    const api = createPathChangesApi(async () => payload);
    await assert.rejects(api.quote(quote.pathId), { kind: "protocol" });
  }
});
test("blocked legacy quotes and not-locked responses remain readable without invented amounts", async () => {
  for (const quote of [
    terminationQuoteFixture({
      status: "BLOCKED",
      allocations: [],
      reasonCodes: ["SESSION_CREDIT_SNAPSHOT_MISSING"],
    }),
    terminationQuoteFixture({
      status: "NOT_LOCKED",
      allocations: [],
      totalSessions: 0,
      completedSessions: 0,
      reasonCodes: ["CREDIT_NOT_HELD"],
    }),
  ]) {
    const api = createPathChangesApi(async () => quote);
    assert.deepEqual(await api.quote(quote.pathId), quote);
  }
  const notes = terminationQuoteNotes([
    "SESSION_CREDIT_SNAPSHOT_MISSING",
    "UNKNOWN_BACKEND_REASON",
  ]);
  assert.match(notes.join(" "), /Lộ trình cũ/);
  assert.doesNotMatch(notes.join(" "), /UNKNOWN_BACKEND_REASON/);
});
test("accepted approval receipts parse before financial execution and forbid all further participant actions", async () => {
  const row = terminationFixture({
    status: "ACCEPTED",
    approvedAt: "2030-01-02T00:00:00Z",
    resolution: {
      approvalDigest: "a".repeat(64),
      reason: "Approved",
      approvedAt: "2030-01-02T00:00:00Z",
    },
  });
  const api = createPathChangesApi(async () => row);
  const receipt = await api.respond(row.pathId, row.id, row.version, true, "");
  assert.deepEqual(receipt, row);
  for (const viewer of [fixtureId(1), fixtureId(2)])
    for (const now of [
      Date.parse(row.createdAt),
      Date.parse(row.expiresAt) + 1,
    ])
      assert.deepEqual(terminationActions(receipt, viewer, now), {
        respond: false,
        withdraw: false,
        escalate: false,
      });
  const path = {
    lockedVersion: 1,
    settledAt: null,
    status: "ACTIVE",
    terminationApprovedAt: row.approvedAt,
  } as ApiLearningPath;
  assert.equal(canRequestTermination(path, []), false);
});
