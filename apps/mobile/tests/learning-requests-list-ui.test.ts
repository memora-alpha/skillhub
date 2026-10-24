import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { AppError } from "../src/lib/http/errors";

type Element = {
  type: unknown;
  props: Record<string, unknown> & {
    children: unknown;
    ListEmptyComponent: Element;
    ListHeaderComponent: Element;
    ListFooterComponent: Element;
    data: unknown[];
    onEndReached: () => void;
    onPress: () => void;
    onClose: () => void;
    onChange: (value: string[]) => void;
    onOptions: (options: { id: string; label: string }[]) => void;
  };
};
const jsx = (type: unknown, props: unknown) => ({ type, props });
function elements(tree: unknown): Element[] {
  if (Array.isArray(tree)) return tree.flatMap(elements);
  if (!tree || typeof tree !== "object" || !("props" in tree)) return [];
  const item = tree as Element;
  return [item, ...elements(item.props.children)];
}

test("Mine keeps cached cards on 429, loads quietly when empty, and exposes permanent errors", () => {
  const local = createRequire(
    new URL(
      "../src/features/learning-requests/components/my-requests-content.tsx",
      import.meta.url,
    ),
  );
  const filename = local.resolve("./my-requests-content.tsx");
  let focused = true,
    active: unknown,
    autoLoads = 0;
  const query = {
    items: [] as unknown[],
    data: undefined as unknown,
    error: new AppError("http", 429) as unknown,
    autoLoadMore: () => autoLoads++,
  };
  const mocks = {
    react: { useState: (initial: unknown) => [initial, () => {}] },
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "react-native": { View: "View" },
    "expo-router": {
      useIsFocused: () => focused,
      useRouter: () => ({ navigate() {} }),
    },
    "@/components/RefreshableFlatList": { RefreshableFlatList: "List" },
    "@/components/EmptyState": { EmptyState: "Empty" },
    "@/components/LoadingIndicator": { LoadingIndicator: "Indicator" },
    "@/lib/query/use-quiet-read-recovery": {
      isTransientReadError: (e: unknown) =>
        e instanceof AppError && (e.status === 429 || e.kind === "network"),
      useQuietReadRecovery() {},
    },
    "./request-list-controls": {
      RequestTabs: "Tabs",
      RequestListSummary: "Summary",
    },
    "./request-list.styles": { requestListStyles: {} },
    "./request-card": { RequestCard: "Card" },
    "./request-state": { RequestFailure: "Failure", RequestLoading: "Loading" },
    "./request-list-footer": { RequestListFooter: "Footer" },
    "./request-list-separator": { RequestListSeparator: "Separator" },
    "../hooks/use-requests": {
      useRequestList: (
        _scope: unknown,
        _filters: unknown,
        enabled: unknown,
      ) => {
        active = enabled;
        return query;
      },
    },
  };
  const contexts = Object.entries(mocks).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  try {
    delete local.cache[filename];
    const { MyRequestsContent } = local(filename);
    let result = MyRequestsContent({}) as Element;
    assert.equal(active, true);
    assert.equal(result.props.ListEmptyComponent.type, "Loading");
    query.data = {};
    assert.equal(
      MyRequestsContent({}).props.ListEmptyComponent.type,
      "Loading",
    );
    assert.equal(
      elements(result.props.ListHeaderComponent).some(
        (e) => e.type === "Failure",
      ),
      false,
    );
    query.items = [{ id: "cached" }];
    query.data = {};
    result = MyRequestsContent({});
    assert.equal(result.props.data.length, 1);
    result.props.onEndReached();
    assert.equal(autoLoads, 1);
    assert.equal(result.props.ListFooterComponent.props.quietTransient, true);
    for (const error of [new AppError("network"), new AppError("http", 429)]) {
      query.error = error;
      assert.equal(
        elements(MyRequestsContent({}).props.ListHeaderComponent).some(
          (e) => e.type === "Failure",
        ),
        false,
      );
    }
    query.error = new AppError("http", 403);
    assert.equal(
      elements(MyRequestsContent({}).props.ListHeaderComponent).some(
        (e) => e.type === "Failure",
      ),
      true,
    );
    focused = false;
    MyRequestsContent({});
    assert.equal(active, false);
  } finally {
    delete local.cache[filename];
    contexts.reverse().forEach((c) => c.restore());
  }
});

test("filter sheet applies named chips, removes one tag, and discards unapplied changes", () => {
  const local = createRequire(
    new URL(
      "../src/features/learning-requests/components/request-feed-filters.tsx",
      import.meta.url,
    ),
  );
  const filename = local.resolve("./request-feed-filters.tsx");
  const states = new Map<number, unknown>();
  let index = 0;
  let filters = { skillId: "", scope: "feed", tagIds: [] as string[] };
  const mocks = {
    react: {
      useCallback: (fn: unknown) => fn,
      useState: (initial: unknown) => {
        const i = index++;
        if (!states.has(i)) states.set(i, initial);
        return [
          states.get(i),
          (next: unknown) =>
            states.set(
              i,
              typeof next === "function" ? next(states.get(i)) : next,
            ),
        ];
      },
    },
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "react-native": {
      View: "View",
      Pressable: "Pressable",
      Text: "Text",
      TextInput: "Input",
    },
    "@/components/Icon": { Icon: "Icon" },
    "@/components/Button": { Button: "Button" },
    "../hooks/use-requests": { useSkillName: () => ({}) },
    "./skill-selector": { SkillSelector: "Skill" },
    "./tag-selector": { TagSelector: "Tags" },
    "./request-list-controls": { RequestTabs: "Tabs" },
    "./request-list.styles": { requestListStyles: {} },
    "./request-picker-sheet": { RequestPickerSheet: "Sheet" },
  };
  const contexts = Object.entries(mocks).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  try {
    delete local.cache[filename];
    const { RequestFeedFilters } = local(filename);
    const render = () => {
      index = 0;
      return elements(
        RequestFeedFilters({
          filters,
          search: "",
          onSearch() {},
          onSubmit() {},
          onApply: (value: typeof filters) => {
            filters = value;
          },
        }),
      );
    };
    const open = () =>
      render()
        .find((e) => e.props.accessibilityLabel === "Bộ lọc yêu cầu học")!
        .props.onPress();
    const closed = render().find((e) => e.type === "Sheet")!;
    assert.equal(closed.props.open, false);
    assert.equal(closed.props.closeIcon, true);
    assert.equal(render().find((e) => e.type === "Tags")!.props.active, false);
    open();
    let tree = render();
    assert.ok(tree.some((e) => e.type === "Sheet"));
    tree
      .find((e) => e.type === "Tags")!
      .props.onOptions([
        { id: "a", label: "React" },
        { id: "b", label: "TypeScript" },
      ]);
    tree.find((e) => e.type === "Tags")!.props.onChange(["a", "b"]);
    tree = render();
    tree.find((e) => e.props.children === "Áp dụng")!.props.onPress();
    tree = render();
    assert.equal(tree.find((e) => e.type === "Sheet")!.props.open, false);
    assert.equal(tree.find((e) => e.type === "Tags")!.props.active, false);
    assert.deepEqual(filters.tagIds, ["a", "b"]);
    assert.ok(tree.some((e) => e.props.children === "TypeScript"));
    tree
      .find((e) => e.props.accessibilityLabel === "Xóa lọc tag React")!
      .props.onPress();
    assert.deepEqual(filters.tagIds, ["b"]);
    open();
    tree = render();
    tree.find((e) => e.type === "Tags")!.props.onChange([]);
    render()
      .find((e) => e.type === "Sheet")!
      .props.onClose();
    assert.deepEqual(
      filters.tagIds,
      ["b"],
      "dismissing must not apply the draft",
    );
    open();
    assert.deepEqual(render().find((e) => e.type === "Tags")!.props.value, [
      "b",
    ]);
    assert.deepEqual(
      render().find((e) => e.type === "Tags")!.props.selectedOptions,
      [
        { id: "a", label: "React" },
        { id: "b", label: "TypeScript" },
      ],
    );
  } finally {
    delete local.cache[filename];
    contexts.reverse().forEach((c) => c.restore());
  }
});

test("sent proposal refresh skips fresh history and refreshes invalidated history once", async () => {
  const local = createRequire(
    new URL(
      "../src/features/proposals/hooks/use-sent-request-proposals.ts",
      import.meta.url,
    ),
  );
  const filename = local.resolve("./use-sent-request-proposals.ts");
  const cache = new QueryClient();
  const key = ["connections", "owner", 1];
  let calls = 0;
  const observer = new QueryObserver(cache, {
    queryKey: [...key, "proposals", "sent-request-status"],
    staleTime: 30000,
    queryFn: async () => {
      calls++;
      return {};
    },
  });
  const stop = observer.subscribe(() => {});
  const mocks = {
    react: { useEffect() {} },
    "@tanstack/react-query": { useQueryClient: () => cache },
    "@/features/connections": {
      useConnections: () => ({ key }),
      useConnectionQuery: () => observer.getCurrentResult(),
    },
    "./use-proposals-api": { useProposalsApi: () => ({}) },
  };
  const contexts = Object.entries(mocks).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  try {
    await observer.refetch({ cancelRefetch: false });
    delete local.cache[filename];
    const { useSentRequestProposals } = local(filename);
    const result = useSentRequestProposals();
    await result.refreshIfStale();
    await result.refreshIfStale();
    assert.equal(calls, 1);
    await cache.invalidateQueries({ queryKey: key, refetchType: "none" });
    await Promise.all([result.refreshIfStale(), result.refreshIfStale()]);
    assert.equal(calls, 2);
  } finally {
    delete local.cache[filename];
    contexts.reverse().forEach((c) => c.restore());
    stop();
    cache.clear();
  }
});
