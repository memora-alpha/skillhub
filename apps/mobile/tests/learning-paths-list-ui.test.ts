import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import { createLearningPathsApi } from "../src/features/learning-paths/api/learning-paths-api";
import type { PathSummary } from "../src/features/learning-paths/api/learning-paths-contract";
import { fixtureId } from "./fixtures/learning-requests-data";
import { overviewFixture } from "./fixtures/path-overview";

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

type Element = { type: unknown; props: Record<string, unknown> };
function elements(tree: unknown): Element[] {
  if (Array.isArray(tree)) return tree.flatMap(elements);
  if (!tree || typeof tree !== "object" || !("props" in tree)) return [];
  const element = tree as Element;
  return [element, ...elements(element.props.children)];
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
  let selectedFilter: unknown = "all";
  const query = {
    items: [path, summary(11)],
    data: {},
    hasNextPage: true,
    isFetching: false,
    isFetchingNextPage: false,
    isFetchNextPageError: false,
    error: undefined as unknown,
    denied: false,
    fetchNextPage,
    refetch,
  };
  const profile = mock.fn(() => ({ data: { fullName: "Đối tác" } }));
  const jsx = (type: unknown, props: unknown) => ({ type, props });
  const mocks = {
    react: {
      useState: () => [
        selectedFilter,
        (value: unknown) => {
          selectedFilter = value;
        },
      ],
    },
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
    const cardText = (value: unknown): string => {
      if (Array.isArray(value)) return value.map(cardText).join(" ");
      if (value && typeof value === "object" && "props" in value)
        return cardText(
          (value as { props: { children?: unknown } }).props.children,
        );
      return typeof value === "string" || typeof value === "number"
        ? String(value)
        : "";
    };
    for (const title of [
      "Học tiếng Anh giao tiếp ".repeat(10),
      null,
      undefined,
      "   ",
    ]) {
      const tree = ApiPathCard({ path: { ...path, title } });
      assert.ok(
        cardText(tree).includes(title?.trim() || "Lộ trình học cùng đối tác"),
      );
      assert.ok(cardText(tree).includes("Học một chiều"));
      assert.doesNotMatch(cardText(tree), /Cập nhật|Bản 1/);
    }
    const { PathListHighlight } = local("./path-list-highlight.tsx");
    const overview = overviewFixture();
    const attention = cardText(PathListHighlight({ overview }));
    assert.match(attention, /Vắng mặt hoặc trễ nghiêm trọng/);
    assert.doesNotMatch(attention, /Buổi tiếp theo|Bạn học/);
    const upcoming = cardText(
      PathListHighlight({
        overview: { ...overview, primaryAttention: null, attentionCount: 0 },
      }),
    );
    assert.match(upcoming, /Buổi tiếp theo/);
    assert.doesNotMatch(upcoming, /hoàn thành|quyết toán/);
    assert.equal(
      PathListHighlight({
        overview: {
          ...overview,
          primaryAttention: null,
          nextSession: null,
          progress: { ...overview.progress, basis: "CURRENT_PLAN" },
        },
      }),
      null,
    );
    const stopped = ApiPathCard({
      path: { ...path, ...overviewFixture(), learningStage: "STOPPED" },
    });
    assert.ok(cardText(stopped).includes("Đã dừng học"));
    assert.ok(!cardText(stopped).includes("Đang học"));
    assert.doesNotMatch(
      cardText(
        ApiPathCard({
          path: {
            ...path,
            ...overviewFixture(),
            learningStage: null,
            stageReasonCode: "LEARNING_STAGE_DATA_INCOMPLETE",
          },
        }),
      ),
      /Chưa xác định|chưa đầy đủ/,
    );
    for (const [status, expectedIcon] of [
      ["ACTIVE", "check-circle"],
      ["CANCELLED", "alert"],
      ["DISPUTED", "alert"],
    ] as const) {
      const stack: unknown[] = [
        ApiPathCard({
          path: { ...path, ...overviewFixture(), status, learningStage: null },
        }),
      ];
      const icons: string[] = [];
      while (stack.length) {
        const node = stack.pop();
        if (Array.isArray(node)) stack.push(...node);
        else if (node && typeof node === "object" && "props" in node) {
          const element = node as {
            type: unknown;
            props: { name?: string; children?: unknown };
          };
          if (element.type === "Icon" && element.props.name)
            icons.push(element.props.name);
          stack.push(element.props.children);
        }
      }
      assert.ok(
        icons.includes(expectedIcon),
        `${status} should retain its status icon when learningStage is absent`,
      );
    }
    props.ListFooterComponent.props.onPress();
    assert.deepEqual(fetchNextPage.mock.calls[0]?.arguments, [
      { cancelRefetch: false },
    ]);
    props.onRefresh();
    assert.deepEqual(refetch.mock.calls[0]?.arguments, [
      { cancelRefetch: false },
    ]);
    const choose = (label: string) => {
      const option = elements(ApiPathsContent().props.ListHeaderComponent).find(
        (node) =>
          node.type === "Pressable" && node.props.accessibilityLabel === label,
      );
      assert.ok(option, `Missing filter: ${label}`);
      (option.props.onPress as () => void)();
      return ApiPathsContent().props;
    };
    assert.equal(
      elements(props.ListHeaderComponent).some(
        (node) => node.props.accessibilityLabel === "Đã xác nhận",
      ),
      false,
    );
    let filtered = choose("Chờ bắt đầu");
    assert.deepEqual(filtered.data, []);
    assert.match(
      cardText(filtered.ListHeaderComponent),
      /Đang lọc trong\s+2\s+lộ trình đã tải/,
    );
    assert.match(filtered.ListEmptyComponent.props.title, /trong phần đã tải/);
    assert.match(filtered.ListEmptyComponent.props.description, /Tải thêm/);
    filtered.onEndReached();
    assert.equal(
      fetchNextPage.mock.callCount(),
      1,
      "selecting a filter does not scan further pages automatically",
    );
    filtered.ListFooterComponent.props.onPress();
    assert.equal(fetchNextPage.mock.callCount(), 2);
    const next = { ...summary(12), status: "SCHEDULED" as const };
    query.items = [...query.items, next];
    filtered = ApiPathsContent().props;
    assert.deepEqual(filtered.data, [next]);
    assert.match(
      cardText(filtered.ListHeaderComponent),
      /Đang lọc trong\s+3\s+lộ trình đã tải/,
    );
    assert.equal(
      elements(filtered.ListHeaderComponent).find(
        (node) => node.props.accessibilityLabel === "Chờ bắt đầu",
      )?.props["aria-checked"],
      true,
    );
    query.error = new Error("Could not load more");
    query.isFetchNextPageError = true;
    filtered = ApiPathsContent().props;
    assert.deepEqual(filtered.data, [next]);
    assert.equal(filtered.ListFooterComponent.type, "Feedback");
    filtered.ListFooterComponent.props.query.refetch();
    assert.equal(fetchNextPage.mock.callCount(), 3);
    query.error = undefined;
    query.isFetchNextPageError = false;
    query.hasNextPage = false;
    filtered = choose("Hoàn thành");
    assert.equal(
      filtered.ListEmptyComponent.props.title,
      "Không có lộ trình ở trạng thái này",
    );
    assert.doesNotMatch(
      cardText(filtered.ListHeaderComponent),
      /chưa tải|đã tải/,
    );
    assert.equal(filtered.ListFooterComponent, null);
    const all = choose("Tất cả");
    assert.deepEqual(
      all.data,
      query.items,
      "filtering never reorders the server's pages",
    );
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
