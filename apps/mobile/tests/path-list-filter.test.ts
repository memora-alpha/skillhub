import assert from "node:assert/strict";
import { test } from "node:test";
import {
  filterPathSummaries,
  pathListFilters,
  type PathListFilter,
} from "../src/features/learning-paths/utils/path-list-filter";
import type { PathSummary } from "../src/features/learning-paths/api/learning-paths-contract";
import { fixtureId } from "./fixtures/learning-requests-data";

test("path list filters cover the whole lifecycle while retaining the server order", () => {
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
  const expected: Partial<Record<PathListFilter, PathSummary["status"][]>> = {
    negotiating: ["DRAFT", "PROPOSED", "PARTIALLY_CONFIRMED", "CONFIRMED"],
    waiting: ["SCHEDULED"],
    learning: ["ACTIVE"],
    settling: [],
    completed: ["COMPLETED"],
    stopped: ["CANCELLED"],
    disputed: ["DISPUTED"],
  };
  for (const { value } of pathListFilters) {
    if (value === "all") continue;
    assert.deepEqual(
      filterPathSummaries(paths, value).map((path) => path.status),
      expected[value],
    );
    assert.deepEqual(filterPathSummaries([], value), []);
  }
  assert.equal(
    paths.every((path) =>
      pathListFilters.some(
        ({ value }) =>
          value !== "all" && filterPathSummaries([path], value).length === 1,
      ),
    ),
    true,
  );
  assert.notEqual(filterPathSummaries(paths, "all"), paths);
  assert.deepEqual(
    paths.map((path) => path.status),
    statuses,
  );
});

test("learning stages distinguish learning finished from settled completion and stopped paths", () => {
  const base: PathSummary = {
    id: fixtureId(1),
    conversationId: fixtureId(11),
    counterpartId: fixtureId(2),
    status: "ACTIVE",
    exchangeType: "ONE_WAY",
    currentVersion: 1,
    lockedVersion: 1,
    createdAt: "2030-01-01T00:00:00Z",
    updatedAt: "2030-01-01T00:00:00Z",
  };
  const stages = [
    "PREPARING",
    "WAITING_START",
    "LEARNING",
    "LEARNING_FINISHED",
    "COMPLETED",
    "STOPPED",
  ] as const;
  const expected: PathListFilter[] = [
    "negotiating",
    "waiting",
    "learning",
    "settling",
    "completed",
    "stopped",
  ];
  for (const [index, learningStage] of stages.entries()) {
    const path = { ...base, learningStage };
    assert.equal(filterPathSummaries([path], expected[index]!).length, 1);
  }
  const finished = { ...base, learningStage: "LEARNING_FINISHED" as const };
  assert.equal(filterPathSummaries([finished], "completed").length, 0);
  assert.equal(filterPathSummaries([finished], "settling").length, 1);
  assert.equal(
    filterPathSummaries([{ ...base, learningStage: null }], "learning").length,
    1,
  );
  assert.equal(
    filterPathSummaries(
      [{ ...base, status: "DISPUTED", learningStage: "STOPPED" }],
      "disputed",
    ).length,
    1,
  );
});
