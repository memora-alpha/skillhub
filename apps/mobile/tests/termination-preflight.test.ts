import assert from "node:assert/strict";
import test from "node:test";
import { preflightTerminationRequest } from "../src/features/learning-paths/utils/termination-preflight";
import { agreementPath, teacherId } from "./fixtures/learning-agreement";
import { terminationFixture } from "./fixtures/path-changes-data";
import { fixtureId } from "./fixtures/learning-requests-data";
import { AppError } from "../src/lib/http/errors";

function fixture(twoWay = false) {
  const path = agreementPath(twoWay);
  path.status = "ACTIVE";
  path.lockedVersion = path.currentVersion;
  const options = {
    pathId: path.id,
    userId: teacherId,
    isCurrent: () => true,
    readPath: async () => path,
    readRequests: async () => [] as ReturnType<typeof terminationFixture>[],
  };
  return { path, options };
}
const code = (expected: string) => (error: unknown) =>
  error instanceof AppError && error.code === expected;

test("preflight permits an active incomplete agreement but rejects completion across both directions", async () => {
  for (const twoWay of [false, true]) {
    const { path, options } = fixture(twoWay);
    await preflightTerminationRequest(options);
    const complete = (index: number) => {
      path.plans[index]!.sessions = [
        {
          id: fixtureId(70 + index),
          sessionNo: 1,
          status: "COMPLETED",
          startAt: "2030-01-02T10:00:00Z",
          endAt: "2030-01-02T11:00:00Z",
        },
      ];
    };
    complete(0);
    if (twoWay) {
      await preflightTerminationRequest(options);
      complete(1);
    }
    await assert.rejects(
      preflightTerminationRequest(options),
      code("TERMINATION_USE_FINAL_SETTLEMENT"),
    );
  }
});

test("fresh pending requests and approval/settlement prevent a new cancellation", async () => {
  const { path, options } = fixture();
  for (const status of ["PENDING", "ACCEPTED", "STAFF_REVIEW"] as const)
    await assert.rejects(
      preflightTerminationRequest({
        ...options,
        readRequests: async () => [
          terminationFixture({ pathId: path.id, status }),
        ],
      }),
      code("CHANGE_REQUEST_ALREADY_PENDING"),
    );
  path.terminationApprovedAt = "2030-01-01T00:00:00Z";
  await assert.rejects(
    preflightTerminationRequest(options),
    code("LEARNING_PATH_CANNOT_BE_CHANGED"),
  );
  path.terminationApprovedAt = null;
  path.settledAt = "2030-01-01T00:00:00Z";
  await assert.rejects(
    preflightTerminationRequest(options),
    code("LEARNING_PATH_CANNOT_BE_CHANGED"),
  );
});

test("preflight never accepts another path, another party, lost access or a changed session", async () => {
  const { options } = fixture();
  await assert.rejects(
    preflightTerminationRequest({ ...options, pathId: fixtureId(80) }),
    (error) => error instanceof AppError && error.kind === "protocol",
  );
  await assert.rejects(
    preflightTerminationRequest({ ...options, userId: fixtureId(80) }),
    (error) => error instanceof AppError && error.kind === "protocol",
  );
  await assert.rejects(
    preflightTerminationRequest({
      ...options,
      readRequests: async () => {
        throw new AppError("http", 403);
      },
    }),
    (error) => error instanceof AppError && error.status === 403,
  );
  let current = true;
  await assert.rejects(
    preflightTerminationRequest({
      ...options,
      isCurrent: () => current,
      readPath: async () => {
        current = false;
        return options.readPath();
      },
    }),
    (error) => error instanceof AppError && error.kind === "session",
  );
});
