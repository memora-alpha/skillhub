import assert from "node:assert/strict";
import { test } from "node:test";
import { agreementPath } from "./fixtures/learning-agreement";
import { fixtureId } from "./fixtures/learning-requests-data";
import { canRequestTermination } from "../src/features/learning-paths/utils/termination-policy";
import { pathSummarySchema } from "../src/features/learning-paths/api/learning-paths-contract";

test("completed agreements cannot create cancellation requests, including both TWO_WAY directions", () => {
  for (const twoWay of [false, true]) {
    const path = agreementPath(twoWay);
    path.status = "ACTIVE";
    path.lockedVersion = path.currentVersion;
    assert.equal(canRequestTermination(path, []), true);
    for (const plan of path.plans) {
      plan.sessions = [
        {
          id: fixtureId(70),
          sessionNo: 1,
          status: "COMPLETED",
          startAt: "2030-01-02T10:00:00Z",
          endAt: "2030-01-02T11:00:00Z",
        },
      ];
    }
    assert.equal(canRequestTermination(path, []), false);
    path.plans.at(-1)!.sessions[0]!.status = "CONFIRMED";
    assert.equal(canRequestTermination(path, []), true);
    path.plans.at(-1)!.sessions = [];
    assert.equal(canRequestTermination(path, []), true);
  }
});

test("path summary retains a server title and accepts null or older responses without it", () => {
  const value = {
    id: fixtureId(1),
    conversationId: fixtureId(2),
    counterpartId: fixtureId(3),
    status: "ACTIVE",
    exchangeType: "ONE_WAY",
    currentVersion: 1,
    lockedVersion: 1,
    createdAt: "2030-01-01T00:00:00Z",
    updatedAt: "2030-01-01T00:00:00Z",
  };
  const title = "Học tiếng Anh giao tiếp";
  assert.equal(pathSummarySchema.parse({ ...value, title }).title, title);
  assert.equal(pathSummarySchema.parse({ ...value, title: null }).title, null);
  assert.equal(pathSummarySchema.safeParse(value).success, true);
  const lastActivityAt = "2030-01-02T00:00:00Z";
  assert.equal(
    pathSummarySchema.parse({ ...value, lastActivityAt }).lastActivityAt,
    lastActivityAt,
  );
  assert.equal(
    pathSummarySchema.safeParse({ ...value, lastActivityAt: "invalid" })
      .success,
    false,
  );
});
