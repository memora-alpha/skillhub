import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import {
  fixtureId,
  fixtureRequest,
  publicFixture,
} from "./fixtures/learning-requests-data";
import { AppError } from "../src/lib/http/errors";

type Element = { type: unknown; props: Record<string, unknown> };
test("Discovery enables reads only while focused and requests avatars only for viewable cards", () => {
  const local = createRequire(
    new URL(
      "../src/features/learning-requests/screens/requests-feed-screen.tsx",
      import.meta.url,
    ),
  );
  const filename = local.resolve("./requests-feed-screen.tsx");
  let focused = true,
    stateIndex = 0,
    refIndex = 0;
  const states = new Map<number, unknown>(),
    refs = new Map<number, { current: unknown }>();
  const items = [100, 101].map((n) =>
    publicFixture({
      actor: fixtureId(1),
      request: fixtureRequest({ id: fixtureId(n) }),
    }),
  );
  const feedCalls: unknown[][] = [],
    proposalCalls: unknown[] = [],
    proposalRefreshes: unknown[] = [];
  let feedRefreshes = 0;
  let feedError: unknown,
    proposalError: unknown,
    feedData: unknown = {};
  const jsx = (type: unknown, props: unknown) => ({ type, props });
  const mocks = {
    react: {
      useEffect() {},
      useRef: (initial: unknown) => {
        const index = refIndex++;
        if (!refs.has(index)) refs.set(index, { current: initial });
        return refs.get(index);
      },
      useState: (initial: unknown) => {
        const index = stateIndex++;
        if (!states.has(index)) states.set(index, initial);
        return [states.get(index), (next: unknown) => states.set(index, next)];
      },
    },
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "react-native": { View: "View" },
    "expo-router": {
      useRouter: () => ({ navigate() {} }),
      useLocalSearchParams: () => ({}),
      useIsFocused: () => focused,
    },
    "@/features/shell": { AppScreenLayout: "Layout" },
    "@/features/connections": { ConnectionFeedback: "Feedback" },
    "@/features/proposals/state": {
      useSentRequestProposals: (options: unknown) => {
        proposalCalls.push(options);
        return {
          data: {},
          error: proposalError,
          refetch: (opts: unknown) => proposalRefreshes.push(opts),
        };
      },
    },
    "@/components/RefreshableFlatList": { RefreshableFlatList: "FlatList" },
    "@/components/EmptyState": { EmptyState: "EmptyState" },
    "../components/request-card": { RequestCard: "Card" },
    "../components/request-feed-filters": { RequestFeedFilters: "Filters" },
    "../components/request-list-controls": {
      RequestCreateButton: "Create",
      RequestListSummary: "Summary",
    },
    "../components/request-list.styles": { requestListStyles: {} },
    "../components/request-state": {
      RequestLoading: "Loading",
      RequestFailure: "Failure",
    },
    "../components/request-list-footer": { RequestListFooter: "Footer" },
    "../components/request-list-separator": {
      RequestListSeparator: "Separator",
    },
    "../hooks/use-requests": {
      useRequestList: (...args: unknown[]) => {
        feedCalls.push(args);
        return {
          items: feedData ? items : [],
          data: feedData,
          error: feedError,
          refetch: () => feedRefreshes++,
        };
      },
    },
  };
  const contexts = Object.entries(mocks).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  try {
    delete local.cache[filename];
    const { RequestsFeedScreen } = local(filename) as {
      RequestsFeedScreen: () => Element;
    };
    const render = () => {
      stateIndex = 0;
      refIndex = 0;
      return (RequestsFeedScreen().props.children as () => Element)();
    };
    const first = render();
    const card = (list: Element, index: number) =>
      (list.props.renderItem as (props: unknown) => Element)({
        item: items[index],
      });
    assert.equal(feedCalls.at(-1)?.[2], true);
    assert.deepEqual(proposalCalls.at(-1), {
      enabled: true,
      refreshOnFocus: "stale",
    });
    assert.equal(card(first, 0).props.loadAvatar, false);
    (first.props.onViewableItemsChanged as (event: unknown) => void)({
      viewableItems: [{ item: items[0], isViewable: true }],
    });
    const visible = render();
    assert.equal(card(visible, 0).props.loadAvatar, true);
    assert.equal(card(visible, 1).props.loadAvatar, false);
    assert.equal(
      visible.props.viewabilityConfig,
      first.props.viewabilityConfig,
    );
    (visible.props.onRefresh as () => void)();
    assert.equal(feedRefreshes, 1);
    assert.deepEqual(proposalRefreshes, [{ cancelRefetch: false }]);
    focused = false;
    const hidden = render();
    assert.equal(feedCalls.at(-1)?.[2], false);
    assert.deepEqual(proposalCalls.at(-1), {
      enabled: false,
      refreshOnFocus: "stale",
    });
    assert.equal(card(hidden, 0).props.loadAvatar, false);
    focused = true;
    feedError = proposalError = new AppError(
      "http",
      429,
      "RATE_LIMITED",
      Date.now() + 60000,
    );
    feedData = undefined;
    const waiting = render();
    assert.equal((waiting.props.ListEmptyComponent as Element).type, "Loading");
    assert.equal(
      JSON.stringify(waiting.props.ListHeaderComponent).includes(
        '"type":"Failure"',
      ),
      false,
    );
    assert.equal(
      JSON.stringify(waiting.props.ListHeaderComponent).includes(
        '"type":"Feedback"',
      ),
      false,
    );
    feedData = {};
    const cached = render();
    assert.equal((cached.props.data as unknown[]).length, 2);
    assert.equal(
      JSON.stringify(cached.props.ListHeaderComponent).includes(
        '"type":"Failure"',
      ),
      false,
    );
    feedError = new AppError("http", 403);
    assert.ok(
      JSON.stringify(render().props.ListHeaderComponent).includes(
        '"type":"Failure"',
      ),
    );
  } finally {
    delete local.cache[filename];
    contexts.reverse().forEach((context) => context.restore());
  }
});
