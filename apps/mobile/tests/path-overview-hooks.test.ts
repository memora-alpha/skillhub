import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import {
  overviewFixture,
  participantCaseFixture,
} from "./fixtures/path-overview";

test("overview and case hooks use resource keys, stop off-focus reads and poll only unresolved state", () => {
  const local = createRequire(
    new URL(
      "../src/features/learning-paths/hooks/use-path-overview.ts",
      import.meta.url,
    ),
  );
  const filename = local.resolve("./use-path-overview.ts");
  let focused = true;
  let runtimeEnabled = true;
  const reads: { key: unknown; valid: boolean; options: unknown }[] = [];
  const polls: boolean[] = [];
  const query = {
    data: overviewFixture(),
    error: undefined,
    denied: false,
    refetch: async () => {},
  };
  const listQuery = {
    items: [participantCaseFixture()],
    error: undefined,
    denied: false,
    refetch: async () => {},
  };
  const mocks = {
    react: { useMemo: (factory: () => unknown) => factory() },
    "expo-router": { useIsFocused: () => focused },
    "@/features/connections": {
      useConnections: () => ({
        enabled: runtimeEnabled,
        call: async () => {},
        isCurrent: () => true,
      }),
      useConnectionQuery: (
        key: unknown,
        _read: unknown,
        valid: boolean,
        options: unknown,
      ) => {
        reads.push({ key, valid, options });
        return query;
      },
      useConnectionList: (
        key: unknown,
        _read: unknown,
        valid: boolean,
        options: unknown,
      ) => {
        reads.push({ key, valid, options });
        return listQuery;
      },
    },
    "./use-agreement-refresh": {
      useAgreementRefresh: (_refresh: unknown, enabled: boolean) =>
        polls.push(enabled),
    },
  };
  const contexts = Object.entries(mocks).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  try {
    delete local.cache[filename];
    const { usePathOverview, usePathCases, usePathCaseSummary } =
      local(filename);
    const id = query.data.settlement.pathId;
    usePathOverview(id);
    assert.deepEqual(reads.at(-1), {
      key: ["learning-paths", id, "overview"],
      valid: true,
      options: { cancelOnDisable: true },
    });
    assert.equal(polls.at(-1), true);
    focused = false;
    usePathOverview(id);
    usePathCases(id);
    usePathCaseSummary(id, participantCaseFixture().id);
    assert.ok(reads.slice(-3).every((read) => !read.valid));
    assert.ok(polls.slice(-3).every((enabled) => !enabled));
    focused = true;
    query.data = {
      ...query.data,
      attentionCount: 0,
      settlement: { ...query.data.settlement, status: "SETTLED" },
    };
    usePathOverview(id);
    assert.equal(polls.at(-1), false);
    usePathOverview("invalid");
    assert.equal(reads.at(-1)?.valid, false);
    assert.equal(polls.at(-1), false);
    runtimeEnabled = false;
    usePathOverview(id);
    assert.equal(reads.at(-1)?.valid, false);
    assert.equal(polls.at(-1), false);
    listQuery.denied = true;
    usePathCases(id);
    assert.equal(polls.at(-1), false);
  } finally {
    delete local.cache[filename];
    contexts.reverse().forEach((context) => context.restore());
  }
});
