import assert from "node:assert/strict";
import test from "node:test";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { refreshLearningPath } from "../src/features/learning-paths/utils/refresh-learning-path";
import { createCompletionAction } from "../src/features/sessions/utils/completion-action";
import {
  sessionsFixture,
  teacherId,
  sessionId,
  now,
} from "./fixtures/sessions-client";

test("completion refresh invalidates only the current owner's related Path and summary", async () => {
  const cache = new QueryClient();
  const scope = ["connections", teacherId, 1],
    path = "path-id";
  const keys = [
    [...scope, "learning-paths", path],
    [...scope, "learning-paths", "mine"],
    [...scope, "learning-paths", "other"],
    ["connections", "other-user", 1, "learning-paths", path],
    ["connections", teacherId, 0, "learning-paths", path],
  ];
  keys.forEach((key) => cache.setQueryData(key, "previous"));
  await refreshLearningPath(cache, scope, path, () => true);
  assert.deepEqual(
    keys.map((key) => cache.getQueryState(key)?.isInvalidated),
    [true, true, false, false, false],
  );
  cache.clear();
  keys.forEach((key) => cache.setQueryData(key, "previous"));
  await refreshLearningPath(cache, scope, path, () => false);
  assert.ok(keys.every((key) => !cache.getQueryState(key)?.isInvalidated));
  cache.clear();
});

test("a failed active Path read preserves the completion receipt and never repeats the POST", async () => {
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const f = sessionsFixture(),
    scope = ["connections", teacherId, 1];
  const key = [...scope, "learning-paths", f.record.pathId];
  cache.setQueryData(key, "stale-path");
  const observer = new QueryObserver(cache, {
    queryKey: key,
    enabled: false,
    queryFn: async () => {
      throw new Error("Path unavailable");
    },
  });
  const unsubscribe = observer.subscribe(() => {});
  observer.setOptions({
    queryKey: key,
    staleTime: Infinity,
    queryFn: async () => {
      throw new Error("Path unavailable");
    },
  });
  const action = createCompletionAction({
    api: f.api,
    userId: teacherId,
    sessionId,
    now: () => now,
    isCurrent: () => f.generation === 1,
    onDetail: (detail) =>
      refreshLearningPath(cache, scope, detail.pathId, () => true),
  });
  await action.run();
  await action.run();
  assert.ok(action.getSnapshot().receipt);
  assert.equal(
    action.getSnapshot().detail?.teacherConfirmationStatus,
    "CONFIRMED",
  );
  assert.equal(f.calls.filter((call) => call.method === "POST").length, 1);
  assert.equal(cache.getQueryState(key)?.status, "error");
  assert.equal(cache.getQueryData(key), "stale-path");
  unsubscribe();
  cache.clear();
});
