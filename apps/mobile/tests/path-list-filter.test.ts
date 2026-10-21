import assert from "node:assert/strict";
import { test } from "node:test";
import { filterPathSummaries } from "../src/features/learning-paths/utils/path-list-filter";
import type { PathSummary } from "../src/features/learning-paths/api/learning-paths-contract";
import { fixtureId } from "./fixtures/learning-requests-data";

test("path list filters distinguish confirmed terms from negotiation and never hide other states from All", () => {
  const statuses: PathSummary["status"][] = [
    "DRAFT",
    "PROPOSED",
    "PARTIALLY_CONFIRMED",
    "CONFIRMED",
    "SCHEDULED",
    "ACTIVE",
    "COMPLETED",
    "CANCELLED",
    "DISPUTED",
  ];
  const paths: readonly PathSummary[] = Object.freeze(
    statuses.map((status, i) => ({
      id: fixtureId(100 + i),
      conversationId: fixtureId(200 + i),
      counterpartId: fixtureId(2),
      status,
      exchangeType: "TWO_WAY" as const,
      currentVersion: 1,
      lockedVersion: null,
      createdAt: "2030-01-01T00:00:00Z",
      updatedAt: "2030-01-01T00:00:00Z",
    })),
  );
  assert.deepEqual(
    filterPathSummaries(paths, "all").map((path) => path.status),
    statuses,
  );
  assert.deepEqual(
    filterPathSummaries(paths, "confirmed").map((path) => path.status),
    ["CONFIRMED"],
  );
  assert.deepEqual(
    filterPathSummaries(paths, "negotiating").map((path) => path.status),
    ["DRAFT", "PROPOSED", "PARTIALLY_CONFIRMED"],
  );
  assert.notEqual(filterPathSummaries(paths, "all"), paths);
  assert.deepEqual(
    paths.map((path) => path.status),
    statuses,
  );
  assert.deepEqual(filterPathSummaries([], "confirmed"), []);
});
