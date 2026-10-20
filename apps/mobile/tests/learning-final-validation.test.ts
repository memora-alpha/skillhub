import assert from "node:assert/strict";
import test from "node:test";
import { load } from "./fixtures/proposal-ui";
import { journeyPath } from "./fixtures/learning-journey-data";
import { canValidateForFinalize } from "../src/features/learning-paths/policy-api";
import { AppError } from "../src/lib/http/errors";

test("automatic preflight uses only the existing read-only validation and binds the full displayed snapshot", async () => {
  const path = journeyPath(true);
  let captured: {
    key: unknown[];
    read: () => Promise<unknown>;
    valid: boolean;
  };
  let response = {
    pathId: path.id,
    version: 1,
    exchangeType: "TWO_WAY",
    planCount: 2,
    scheduleCount: 2,
    ready: true,
  };
  const calls: string[] = [];
  const state = {
    data: response as unknown,
    error: undefined as unknown,
    isFetching: false,
  };
  const hook = load(
    "../../src/features/learning-paths/hooks/use-final-validation.ts",
    {
      "@/features/connections": {
        useConnectionQuery: (
          key: unknown[],
          read: () => Promise<unknown>,
          valid: boolean,
        ) => {
          captured = { key, read, valid };
          return state;
        },
      },
      "@/lib/http/errors": { AppError },
      "../policy-api": { canValidateForFinalize },
      "./use-learning-paths-api": {
        useLearningPathsApi: () => ({
          validate: async (id: string) => {
            calls.push(id);
            return response;
          },
        }),
      },
    },
  ).useFinalValidation as unknown as (
    path: ReturnType<typeof journeyPath>,
    blocked: boolean,
  ) => { canFinalize: boolean };
  assert.equal(hook(path, false).canFinalize, true);
  assert.equal(captured!.valid, true);
  const key = JSON.stringify(captured!.key);
  await captured!.read();
  assert.deepEqual(calls, [path.id]);
  response = { ...response, version: 2 };
  await assert.rejects(captured!.read(), AppError);
  path.plans[0]!.schedule!.items[0]!.startAt = new Date(
    Date.now() + 9 * 86400000,
  ).toISOString();
  hook(path, false);
  assert.notEqual(JSON.stringify(captured!.key), key);
  hook(path, true);
  assert.equal(captured!.valid, false);
  state.error = new Error("stale validation failed");
  assert.equal(hook(path, false).canFinalize, false);
  state.error = undefined;
  state.isFetching = true;
  assert.equal(hook(path, false).canFinalize, false);
});
