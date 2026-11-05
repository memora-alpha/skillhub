import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import { createLearningPathsApi } from "../src/features/learning-paths/api/learning-paths-api";
import type { PathSummary } from "../src/features/learning-paths/api/learning-paths-contract";
import { fixtureId } from "./fixtures/learning-requests-data";

function summary(id: number): PathSummary {
  return {
    id: fixtureId(id),
    conversationId: fixtureId(id + 100),
    counterpartId: fixtureId(2),
    status: "ACTIVE",
    exchangeType: "ONE_WAY",
    currentVersion: 1,
    lockedVersion: 1,
    createdAt: "2030-01-01T00:00:00Z",
    updatedAt: "2030-01-01T00:00:00Z",
  };
}

test("My Learning reads one bounded page while the exhaustive lookup still follows the cursor", async () => {
  const signal = new AbortController().signal;
  const calls: string[] = [];
  const api = createLearningPathsApi(async (path, options) => {
    calls.push(path);
    assert.equal(options?.signal, signal);
    const next = path.includes("cursor=");
    return {
      data: [summary(next ? 11 : 10)],
      meta: {
        pagination: {
          limit: next ? 20 : 100,
          hasMore: !next,
          nextCursor: next ? null : "next",
        },
      },
    };
  }, fixtureId(1));
  const first = await api.minePage(undefined, signal);
  assert.deepEqual(first.items, [summary(10)]);
  assert.deepEqual(calls, ["/learning-paths/mine?limit=20"]);
  const next = await api.minePage(first.nextCursor!, signal);
  assert.deepEqual(next.items, [summary(11)]);
  assert.equal(calls[1], "/learning-paths/mine?limit=20&cursor=next");
  assert.deepEqual(await api.mine(signal), [summary(10), summary(11)]);
  assert.deepEqual(calls.slice(2), [
    "/learning-paths/mine",
    "/learning-paths/mine?cursor=next",
  ]);
});

test("path list renders its first page, loads another on request, and only enriches visible cards", () => {
  const local = createRequire(
    new URL(
      "../src/features/learning-paths/components/ApiPathsContent.tsx",
      import.meta.url,
    ),
  );
  const filename = local.resolve("./ApiPathsContent.tsx");
  const path = summary(10);
  const fetchNextPage = mock.fn();
  const refetch = mock.fn();
  let focused = true;
  const query = {
    items: [path, summary(11)],
    data: {},
    hasNextPage: true,
    isFetching: false,
    fetchNextPage,
    refetch,
  };
  const profile = mock.fn(() => ({ data: { fullName: "Đối tác" } }));
  const jsx = (type: unknown, props: unknown) => ({ type, props });
  const mocks = {
    react: { useState: (value: unknown) => [value] },
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "react-native": {
      Pressable: "Pressable",
      ScrollView: "ScrollView",
      Text: "Text",
      View: "View",
      StyleSheet: { create: (styles: unknown) => styles },
    },
    "expo-router": { useIsFocused: () => focused },
    "@/components/RefreshableFlatList": { RefreshableFlatList: "List" },
    "@/components/use-visible-list-rows": {
      useVisibleListRows: () => ({ visibleIds: new Set([path.id]) }),
    },
    "@/components/Button": { Button: "Button" },
    "@/components/feature-page": { Copy: "Copy", RouteButton: "RouteButton" },
    "@/components/EmptyState": { EmptyState: "Empty" },
    "@/components/Avatar": { Avatar: "Avatar" },
    "@/components/Icon": { Icon: "Icon" },
    "@/features/connections": { useParticipantProfile: profile },
    "./PathReadFeedback": { PathReadFeedback: "Feedback" },
    "../hooks/use-learning-paths-api": {
      useLearningPathPages: (active: boolean) => {
        assert.equal(active, focused);
        return query;
      },
    },
  };
  const contexts = Object.entries(mocks).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  try {
    delete local.cache[filename];
    const { ApiPathsContent, ApiPathCard } = local(filename);
    const { props } = ApiPathsContent();
    assert.deepEqual(props.data, query.items);
    assert.equal(fetchNextPage.mock.callCount(), 0);
    const first = props.renderItem({ item: path }).props;
    const second = props.renderItem({ item: query.items[1] }).props;
    ApiPathCard(first);
    ApiPathCard(second);
    assert.deepEqual(
      profile.mock.calls.map((call) => call.arguments),
      [
        [path.counterpartId, true],
        [path.counterpartId, false],
      ],
    );
    props.ListFooterComponent.props.onPress();
    assert.deepEqual(fetchNextPage.mock.calls[0]?.arguments, [
      { cancelRefetch: false },
    ]);
    props.onRefresh();
    assert.deepEqual(refetch.mock.calls[0]?.arguments, [
      { cancelRefetch: false },
    ]);
    focused = false;
    assert.equal(
      ApiPathsContent().props.renderItem({ item: path }).props.loadProfile,
      false,
    );
  } finally {
    delete local.cache[filename];
    contexts.reverse().forEach((context) => context.restore());
  }
});
