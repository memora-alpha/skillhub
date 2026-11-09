import assert from "node:assert/strict";
import test from "node:test";
import { QueryClient } from "@tanstack/react-query";
import { createPathOverviewApi } from "../src/features/learning-paths/api/path-overview-api";
import { createLearningPathsApi } from "../src/features/learning-paths/api/learning-paths-api";
import { createPathChangesApi } from "../src/features/learning-paths/api/path-changes-api";
import { readLearningPath } from "../src/features/learning-paths/api/learning-paths-read";
import { pathSummarySchema } from "../src/features/learning-paths/api/learning-paths-contract";
import { refreshLearningPath } from "../src/features/learning-paths/utils/refresh-learning-path";
import {
  learningStageLabel,
  pathTargetHref,
} from "../src/features/learning-paths/utils/path-overview-presentation";
import { AppError } from "../src/lib/http/errors";
import { fixtureId } from "./fixtures/learning-requests-data";
import { agreementPath, teacherId } from "./fixtures/learning-agreement";
import {
  overviewFixture,
  participantCaseFixture,
} from "./fixtures/path-overview";

function page(items: unknown[], cursor: string | null = null) {
  return {
    data: items,
    meta: {
      pagination: { limit: 20, hasMore: cursor !== null, nextCursor: cursor },
    },
  };
}
test("overview GET preserves BE stage, both directions, next session and actions without writes", async () => {
  const view = overviewFixture(),
    signal = new AbortController().signal;
  const api = createPathOverviewApi(async (url, options) => {
    assert.equal(url, `/learning-paths/${view.settlement.pathId}/overview`);
    assert.equal(options?.signal, signal);
    assert.equal(options?.method, undefined);
    return view;
  });
  assert.deepEqual(await api.overview(view.settlement.pathId, signal), view);
});
test("list retains new overview fields and legacy lists remain readable", async () => {
  const view = overviewFixture();
  const base = {
    id: view.settlement.pathId,
    title: "Học dự án",
    conversationId: fixtureId(40),
    status: "DISPUTED",
    exchangeType: "TWO_WAY",
    counterpartId: fixtureId(2),
    currentVersion: 3,
    lockedVersion: 3,
    createdAt: view.evaluatedAt,
    updatedAt: view.evaluatedAt,
  };
  const api = createLearningPathsApi(
    async () => page([{ ...base, ...view }]),
    teacherId,
  );
  const item = (await api.minePage()).items[0]!;
  assert.equal(item.status, "DISPUTED");
  assert.equal(item.learningStage, "LEARNING");
  assert.deepEqual(item.progress, view.progress);
  assert.deepEqual(item.primaryAction, view.primaryAction);
  assert.equal(pathSummarySchema.safeParse(base).success, true);
  assert.equal(
    pathSummarySchema.safeParse({ ...base, learningStage: "LEARNING" }).success,
    false,
  );
});
test("detail retains embedded overview and refuses foreign or inconsistent snapshots", () => {
  const path = agreementPath();
  const view = { ...overviewFixture(), nextSession: null };
  const { attentionItems, ...overview } = view;
  const response = { ...path, overview, attentionItems };
  assert.deepEqual(
    readLearningPath(response, path.id, teacherId).overview,
    overview,
  );
  assert.deepEqual(
    readLearningPath(response, path.id, teacherId).attentionItems,
    attentionItems,
  );
  for (const invalid of [
    { ...response, attentionItems: [] },
    {
      ...response,
      overview: { ...overview, nextSession: overviewFixture().nextSession },
    },
    {
      ...response,
      overview: {
        ...overview,
        settlement: { ...overview.settlement, pathId: fixtureId(99) },
      },
    },
  ])
    assert.throws(
      () => readLearningPath(invalid, path.id, teacherId),
      AppError,
    );
});
test("malformed progress, attention, times and settlement identities fail closed", async () => {
  const view = overviewFixture(),
    id = view.settlement.pathId;
  for (const invalid of [
    {
      ...view,
      progress: { ...view.progress, teaching: { completed: 5, total: 4 } },
    },
    {
      ...view,
      nextSession: { ...view.nextSession, endAt: view.nextSession!.startAt },
    },
    { ...view, attentionCount: 2 },
    { ...view, primaryAttention: null },
    { ...view, settlement: { ...view.settlement, pathId: fixtureId(99) } },
    {
      ...view,
      primaryAction: {
        code: "VIEW_SETTLEMENT",
        target: { type: "LEARNING_PATH", id: fixtureId(99) },
      },
    },
  ])
    await assert.rejects(
      createPathOverviewApi(async () => invalid).overview(id),
      AppError,
    );
});
test("participant cases use scoped pagination and strip private report fields", async () => {
  const item = participantCaseFixture(),
    signal = new AbortController().signal;
  const api = createPathOverviewApi(async (url, options) => {
    assert.equal(
      url,
      `/learning-paths/${item.relatedPathId}/cases?limit=20&cursor=opaque%2Bcursor`,
    );
    assert.equal(options?.includeMeta, true);
    assert.equal(options?.signal, signal);
    return page(
      [
        {
          ...item,
          reporterId: fixtureId(2),
          description: "private",
          evidence: ["secret"],
        },
      ],
      "next",
    );
  });
  const result = await api.cases(item.relatedPathId, "opaque+cursor", signal);
  assert.deepEqual(result.items, [item]);
  assert.equal(result.nextCursor, "next");
});
test("case summary strips private fields and verifies case, path and attention identity", async () => {
  const item = participantCaseFixture();
  const summary = { ...item, attention: overviewFixture().primaryAttention };
  const api = createPathOverviewApi(async () => ({
    ...summary,
    description: "private",
    resolutionNote: "private",
  }));
  assert.deepEqual(await api.caseSummary(item.relatedPathId, item.id), summary);
  for (const invalid of [
    { ...summary, id: fixtureId(99) },
    { ...summary, relatedPathId: fixtureId(99) },
    {
      ...summary,
      attention: {
        ...summary.attention,
        target: { type: "CASE_SUMMARY", id: fixtureId(99) },
      },
    },
  ])
    await assert.rejects(
      createPathOverviewApi(async () => invalid).caseSummary(
        item.relatedPathId,
        item.id,
      ),
      AppError,
    );
});
test("case pages reject cross-path rows, duplicate identities and malformed cursor metadata", async () => {
  const item = participantCaseFixture();
  for (const data of [
    page([{ ...item, relatedPathId: fixtureId(99) }]),
    page([item, item]),
    {
      data: [item],
      meta: { pagination: { limit: 20, hasMore: true, nextCursor: null } },
    },
  ])
    await assert.rejects(
      createPathOverviewApi(async () => data).cases(item.relatedPathId),
      AppError,
    );
});
test("denial propagates to the shared read-access boundary without a fallback request", async () => {
  let calls = 0;
  const denial = new AppError("http", 403, "PATH_ACCESS_DENIED");
  const api = createPathOverviewApi(async () => {
    calls++;
    throw denial;
  });
  await assert.rejects(
    api.overview(fixtureId(30)),
    (error) => error === denial,
  );
  assert.equal(calls, 1);
});
test("settlement retains related targets and rejects a foreign path target", async () => {
  const status = overviewFixture().settlement;
  assert.deepEqual(
    await createPathChangesApi(async () => status).settlement(status.pathId),
    status,
  );
  await assert.rejects(
    createPathChangesApi(async () => ({
      ...status,
      nextActionTarget: { type: "LEARNING_PATH", id: fixtureId(99) },
    })).settlement(status.pathId),
    AppError,
  );
});
test("navigation uses local targets and never promotes a server action to a mutation", () => {
  const path = fixtureId(30),
    id = fixtureId(71),
    sessionId = fixtureId(61);
  assert.equal(
    pathTargetHref(path, { type: "CASE_SUMMARY", id }),
    `/paths/${path}/cases/${id}`,
  );
  assert.equal(
    pathTargetHref(path, { type: "SESSION", id: sessionId }),
    `/learning-sessions/${sessionId}`,
  );
  assert.equal(
    pathTargetHref(path, { type: "LEARNING_CHANGE", id }, sessionId),
    `/learning-sessions/${sessionId}`,
  );
  assert.equal(
    pathTargetHref(path, { type: "LEARNING_CHANGE", id }),
    `/paths/${path}/cancel?changeRequestId=${id}`,
  );
  assert.equal(pathTargetHref(path, { type: "LEARNING_PATH", id }), undefined);
  assert.equal(
    pathTargetHref(path, { type: "https://external.test", id }),
    undefined,
  );
  assert.equal(
    pathTargetHref(path, { type: "SESSION", id: "../secret" }),
    undefined,
  );
  assert.equal(learningStageLabel("STOPPED"), "Đã dừng học");
  assert.equal(learningStageLabel(null), undefined);
});
test("resource refresh invalidates overview, cases and settlement only in the active owner scope", async () => {
  const cache = new QueryClient(),
    scope = ["connections", "owner", 2],
    id = fixtureId(30);
  const keys = [
    [...scope, "learning-paths", id],
    [...scope, "learning-paths", id, "overview"],
    [...scope, "learning-paths", id, "cases"],
    [...scope, "learning-paths", id, "settlement"],
    [...scope, "learning-paths", "mine", "pages"],
    [...scope, "learning-paths", fixtureId(99), "overview"],
    ["connections", "other-owner", 2, "learning-paths", id, "overview"],
  ];
  try {
    keys.forEach((key) => cache.setQueryData(key, {}));
    await refreshLearningPath(cache, scope, id, () => true);
    assert.deepEqual(
      keys.map((key) => cache.getQueryState(key)?.isInvalidated),
      [true, true, true, true, true, false, false],
    );
    keys.forEach((key) => cache.setQueryData(key, {}));
    await refreshLearningPath(cache, scope, id, () => false);
    assert.ok(keys.every((key) => !cache.getQueryState(key)?.isInvalidated));
  } finally {
    cache.clear();
  }
});
