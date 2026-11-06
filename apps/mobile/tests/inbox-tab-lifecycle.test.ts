import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import {
  QueryClient,
  QueryObserver,
  type QueryObserverOptions,
} from "@tanstack/react-query";
import { fixtureId } from "./fixtures/learning-requests-data";
import { AppError } from "../src/lib/http/errors";
import { isTransientReadError } from "../src/lib/query/use-quiet-read-recovery";

test("Inbox shows loading for a transient first read, preserves cached empty/content and still exposes denial", () => {
  const local = createRequire(
    new URL(
      "../src/features/messages/screens/ApiMessagesScreen.tsx",
      import.meta.url,
    ),
  );
  const filename = local.resolve("./ApiMessagesScreen.tsx");
  const state = {
    data: undefined as unknown,
    items: [] as unknown[],
    error: new AppError("http", 429) as unknown,
    isPending: false,
    isFetching: false,
    hasNextPage: false,
    refetch() {},
    loadMore() {
      loadedPages++;
    },
  };
  let loadedPages = 0;
  const params: { tab?: string } = {};
  let requestedType: unknown;
  const routes: string[] = [];
  const jsx = (type: unknown, props: unknown) => ({ type, props });
  const mocks = {
    react: { useEffect: (effect: () => void) => effect() },
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "react-native": {
      View: "View",
      Text: "Text",
      Pressable: "Pressable",
      ActivityIndicator: "Loading",
      StyleSheet: { create: (styles: unknown) => styles },
    },
    "expo-router": {
      useRouter: () => ({
        push: (path: string) => routes.push(path),
        setParams: (next: { tab: string }) => Object.assign(params, next),
      }),
      useLocalSearchParams: () => params,
      useIsFocused: () => true,
    },
    "@/features/shell": { AppScreenLayout: "Layout" },
    "@/features/connections": { ConnectionFeedback: "Feedback" },
    "@/components/RefreshableFlatList": { RefreshableFlatList: "FlatList" },
    "@/components/Button": { Button: "Button" },
    "@/components/EmptyState": { EmptyState: "Empty" },
    "@/components/LoadingIndicator": { LoadingIndicator: "Loading" },
    "../components/ConversationRow": { ConversationRow: "Row" },
    "../components/ConversationCard": { ConversationCard: "Card" },
    "../components/RequestInboxCard": { RequestInboxCard: "RequestCard" },
    "../hooks/use-inbox-groups": {
      useInboxGroups: (_ids: unknown, type: unknown) => {
        requestedType = type;
        return state;
      },
    },
    "@/components/use-visible-list-rows": {
      useVisibleListRows: () => ({ visibleIds: new Set() }),
    },
    "@/lib/query/use-quiet-read-recovery": {
      isTransientReadError,
      useQuietReadRecovery() {},
    },
  };
  const contexts = Object.entries(mocks).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  try {
    delete local.cache[filename];
    const { ApiMessagesScreen } = local(filename);
    const action = ApiMessagesScreen().props.rightAction;
    assert.equal(action.props.children.props.children, "Đề xuất");
    action.props.onPress();
    assert.deepEqual(routes, ["/proposals"]);
    const render = () => ApiMessagesScreen().props.children();
    const feedback = (list: ReturnType<typeof render>) =>
      list.props.ListHeaderComponent.props.children[1].props;
    const loading = render();
    assert.equal(requestedType, "LEARNING_REQUEST");
    assert.equal(feedback(loading).loading, true);
    assert.equal(feedback(loading).error, undefined);
    assert.equal(loading.props.ListEmptyComponent, null);
    state.data = { pages: [] };
    const cachedEmpty = render();
    assert.equal(feedback(cachedEmpty).loading, false);
    assert.equal(cachedEmpty.props.ListEmptyComponent.type, "Empty");
    state.error = undefined;
    state.hasNextPage = true;
    const scanning = render();
    assert.equal(scanning.props.ListEmptyComponent, null);
    assert.equal(feedback(scanning).loading, true);
    assert.equal(
      loadedPages,
      1,
      "skip pages without request groups before claiming the inbox is empty",
    );
    state.hasNextPage = false;
    state.items = [{ conversation: { id: fixtureId(1) } }];
    assert.equal(render().props.data, state.items);
    state.error = new AppError("http", 403);
    assert.equal(feedback(render()).error, state.error);
    const tabs = render().props.ListHeaderComponent.props.children[0];
    const buttons = tabs.type(tabs.props).props.children;
    assert.deepEqual(
      buttons.map(
        (item: { props: { children: { props: { children: string } } } }) =>
          item.props.children.props.children,
      ),
      ["Theo yêu cầu học", "Trao đổi trực tiếp"],
    );
    buttons[1].props.onPress();
    assert.equal(params.tab, "direct");
    state.items = [];
    state.error = undefined;
    assert.equal(
      render().props.ListEmptyComponent.props.title,
      "Chưa có trao đổi trực tiếp",
    );
    assert.equal(requestedType, "DIRECT_CONVERSATION");
    state.hasNextPage = true;
    assert.equal(render().props.ListEmptyComponent, null);
    assert.equal(
      loadedPages,
      2,
      "a direct tab must scan later mixed pages before claiming it is empty",
    );
    params.tab = "unknown";
    render();
    assert.equal(requestedType, "LEARNING_REQUEST");
  } finally {
    delete local.cache[filename];
    contexts.reverse().forEach((context) => context.restore());
  }
});

test("grouped Inbox skips the secondary list until a group with chat is visible", () => {
  const local = createRequire(
    new URL(
      "../src/features/messages/hooks/use-inbox-groups.ts",
      import.meta.url,
    ),
  );
  const filename = local.resolve("./use-inbox-groups.ts");
  const requestId = fixtureId(1);
  const otherId = fixtureId(2);
  const requestGroups = [
    { id: `request:${requestId}`, conversationCount: 0 },
    { id: `request:${otherId}`, conversationCount: 1 },
  ].map((group) => ({
    ...group,
    groupType: "LEARNING_REQUEST",
    lastActivityAt: "2026-10-23T00:00:00Z",
  }));
  const directId = fixtureId(4);
  const direct = {
    id: `conversation:${directId}`,
    conversationId: directId,
    groupType: "DIRECT_CONVERSATION",
    conversationCount: 1,
    lastActivityAt: "2026-10-24T00:00:00Z",
  };
  const groups = [...requestGroups, direct];
  type PreviewOptions = NonNullable<
    Parameters<
      typeof import("../src/features/messages/hooks/use-conversation-inbox").useConversationInbox
    >[0]
  >;
  let previewOptions: PreviewOptions | undefined;
  const mocks = {
    react: { useCallback: (fn: unknown) => fn },
    "expo-router": { useIsFocused: () => true },
    "@/features/connections": {
      useConnections: () => ({ userId: fixtureId(3) }),
    },
    "./use-messages-api": {
      useGroupedInbox: () => ({ items: groups, hasNextPage: true }),
    },
    "./use-conversation-inbox": {
      useConversationInbox: (options: PreviewOptions) => {
        previewOptions = options;
        return { items: [] };
      },
    },
  };
  const contexts = Object.entries(mocks).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  try {
    delete local.cache[filename];
    const { useInboxGroups } = local(
      filename,
    ) as typeof import("../src/features/messages/hooks/use-inbox-groups");
    assert.equal(useInboxGroups(new Set()).items.length, 3);
    assert.equal(previewOptions?.enabled, false);
    useInboxGroups(new Set([`request:${requestId}`]));
    assert.equal(previewOptions?.enabled, false);
    useInboxGroups(new Set([`request:${otherId}`]));
    assert.equal(previewOptions?.enabled, true);
    const visibleIds = new Set([`request:${otherId}`, direct.id]);
    const requests = useInboxGroups(visibleIds, "LEARNING_REQUEST");
    assert.deepEqual(
      requests.items.map(({ group }) => group.id),
      requestGroups.map((group) => group.id),
    );
    assert.equal(
      requests.hasNextPage,
      true,
      "filtering must retain the server cursor coverage",
    );
    const directConversation = {
      id: directId,
      proposalId: fixtureId(5),
      learningRequestId: null,
      participantAId: fixtureId(3),
      participantBId: otherId,
      createdAt: direct.lastActivityAt,
    };
    assert.equal(
      previewOptions?.shouldLoadPreview?.(directConversation),
      false,
    );
    const directOnly = useInboxGroups(visibleIds, "DIRECT_CONVERSATION");
    assert.deepEqual(
      directOnly.items.map(({ group }) => group.id),
      [direct.id],
    );
    assert.equal(previewOptions?.shouldLoadPreview?.(directConversation), true);
    assert.equal(
      previewOptions?.shouldLoadPreview?.({
        ...directConversation,
        learningRequestId: otherId,
      }),
      false,
    );
    useInboxGroups(new Set([`request:${otherId}`]), "DIRECT_CONVERSATION");
    assert.equal(
      previewOptions?.enabled,
      false,
      "stale viewability from the previous tab must not enable previews",
    );
  } finally {
    delete local.cache[filename];
    contexts.reverse().forEach((context) => context.restore());
  }
});

test("connection read cancellation on disable aborts the pending transport and retains existing cache", async () => {
  const local = createRequire(
    new URL("../src/features/connections/hooks.ts", import.meta.url),
  );
  const filename = local.resolve("./hooks.ts");
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  const base = ["connections", fixtureId(1), 1];
  const key = [...base, "participant-profile", fixtureId(2)];
  cache.setQueryData(key, "cached");
  let effects: (() => void)[] = [];
  let observer: QueryObserver | undefined, stop: (() => void) | undefined;
  let signal!: AbortSignal;
  const mocks = {
    react: {
      useMemo: (fn: () => unknown) => fn(),
      useCallback: (fn: unknown) => fn,
      useEffect: (fn: () => void) => effects.push(fn),
    },
    "react-native": { AppState: {} },
    "expo-router": { useFocusEffect() {} },
    "expo-crypto": { randomUUID: () => fixtureId(5) },
    "@tanstack/react-query": {
      useQueryClient: () => cache,
      useQuery: (options: QueryObserverOptions) => {
        if (!observer) {
          observer = new QueryObserver(cache, options);
          stop = observer.subscribe(() => {});
        } else observer.setOptions(options);
        return observer.getCurrentResult();
      },
    },
    "./runtime": {
      useConnections: () => ({
        key: base,
        enabled: true,
        isCurrent: () => true,
      }),
    },
  };
  const contexts = Object.entries(mocks).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  try {
    delete local.cache[filename];
    const { useConnectionQuery } = local(
      filename,
    ) as typeof import("../src/features/connections/hooks");
    const load = async (next: AbortSignal) => {
      signal = next;
      return new Promise<never>((_resolve, reject) =>
        next.addEventListener("abort", () => reject(new AppError("session")), {
          once: true,
        }),
      );
    };
    const render = (valid: boolean) => {
      effects = [];
      const result = useConnectionQuery(
        ["participant-profile", fixtureId(2)],
        load,
        valid,
        { cancelOnDisable: true },
      );
      effects.forEach((fn) => fn());
      return result;
    };
    render(true);
    assert.equal(signal.aborted, false);
    render(false);
    assert.equal(signal.aborted, true);
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(cache.getQueryData(key), "cached");
    assert.equal(render(false).data, "cached");
  } finally {
    stop?.();
    cache.clear();
    delete local.cache[filename];
    contexts.reverse().forEach((context) => context.restore());
  }
});

test("Inbox only reads visible previews and cancels unshared reads on scroll or blur", async () => {
  const local = createRequire(
    new URL(
      "../src/features/messages/hooks/use-conversation-inbox.ts",
      import.meta.url,
    ),
  );
  const filename = local.resolve("./use-conversation-inbox.ts");
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 30000 } },
  });
  const base = ["connections", fixtureId(1), 1];
  let focused = true;
  let effects: (() => void)[] = [];
  const listEnabled: boolean[] = [],
    refreshEnabled: boolean[] = [];
  const signals = new Map<string, AbortSignal>();
  const finishes = new Map<string, () => void>();
  const observers: QueryObserver[] = [],
    stops: (() => void)[] = [];
  const items = Array.from({ length: 20 }, (_, index) => ({
    id: fixtureId(index + 10),
    proposalId: fixtureId(index + 30),
    learningRequestId: null,
    participantAId: fixtureId(1),
    participantBId: fixtureId(2),
    createdAt: "2026-10-23T00:00:00Z",
  }));
  const runtime = {
    key: base,
    enabled: true,
    userId: fixtureId(1),
    isCurrent: () => true,
  };
  const api = {
    history: async (id: string, { signal }: { signal: AbortSignal }) => {
      signals.set(id, signal);
      await new Promise<void>((resolve, reject) => {
        finishes.set(id, resolve);
        signal.addEventListener(
          "abort",
          () => reject(new AppError("session")),
          { once: true },
        );
      });
      return { items: [], hasMore: false, nextCursor: null };
    },
  };
  const mocks = {
    react: {
      useCallback: (fn: unknown) => fn,
      useEffect: (fn: () => void) => effects.push(fn),
    },
    "expo-router": { useIsFocused: () => focused },
    "@tanstack/react-query": {
      useQueryClient: () => cache,
      useQueries: ({ queries }: { queries: QueryObserverOptions[] }) =>
        queries.map((options, index) => {
          if (!observers[index]) {
            observers[index] = new QueryObserver(cache, options);
            stops.push(observers[index]!.subscribe(() => {}));
          } else observers[index]!.setOptions(options);
          return observers[index]!.getCurrentResult();
        }),
    },
    "@/features/connections": {
      useConnections: () => runtime,
      useConnectionRefresh: (_fn: unknown, enabled: boolean) =>
        refreshEnabled.push(enabled),
    },
    "./use-messages-api": {
      useMessagesApi: () => api,
      useConversations: (enabled: boolean) => {
        listEnabled.push(enabled);
        return { items, denied: false, refetch() {} };
      },
    },
    "../context/ChatOutbox": { useChatOutboxEntries: () => [] },
    "@/lib/query/use-quiet-read-recovery": {
      isTransientReadError,
      useQuietReadRecovery() {},
    },
  };
  const contexts = Object.entries(mocks).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  try {
    delete local.cache[filename];
    const { useConversationInbox } = local(
      filename,
    ) as typeof import("../src/features/messages/hooks/use-conversation-inbox");
    let visibleIds = new Set<string>();
    const render = () => {
      effects = [];
      const result = useConversationInbox({
        shouldLoadPreview: (conversation) => visibleIds.has(conversation.id),
      });
      effects.forEach((fn) => fn());
      return result;
    };
    assert.equal(render().items.length, 20);
    assert.equal(signals.size, 0, "no preview is needed to show the list");
    visibleIds = new Set([items[0]!.id, items[1]!.id]);
    render();
    assert.equal(signals.size, 2, "two visible rows need two history reads");
    visibleIds = new Set([items[1]!.id]);
    render();
    assert.equal(signals.get(items[0]!.id)!.aborted, true);
    assert.equal(signals.get(items[1]!.id)!.aborted, false);
    // A concurrent consumer must keep the second query alive after Inbox blurs.
    const shared = new QueryObserver(cache, {
      ...observers[1]!.options,
      enabled: true,
    });
    const stopShared = shared.subscribe(() => {});
    stops.push(stopShared);
    focused = false;
    render();
    assert.deepEqual(listEnabled, [true, true, true, false]);
    assert.deepEqual(refreshEnabled, [true, true, true, false]);
    assert.equal(signals.get(items[0]!.id)!.aborted, true);
    assert.equal(signals.get(items[1]!.id)!.aborted, false);
    finishes.get(items[1]!.id)!();
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.ok(
      cache.getQueryData([...base, "conversations", "preview", items[1]!.id]),
    );
    const retained = render();
    assert.equal(
      retained.items.length,
      20,
      "blur retains the cached conversation list",
    );
  } finally {
    stops.forEach((stop) => stop());
    cache.clear();
    delete local.cache[filename];
    contexts.reverse().forEach((context) => context.restore());
  }
});

test("Inbox row keeps cache identities but disables profile and topic reads on an inactive tab", () => {
  const local = createRequire(
    new URL(
      "../src/features/messages/components/ConversationRow.tsx",
      import.meta.url,
    ),
  );
  const filename = local.resolve("./ConversationRow.tsx");
  let focused = true;
  const profiles: unknown[][] = [],
    topics: unknown[][] = [];
  const jsx = (type: unknown, props: unknown) => ({ type, props });
  const mocks = {
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "expo-router": {
      useIsFocused: () => focused,
      useRouter: () => ({ push() {} }),
    },
    "@/features/connections": {
      useConnections: () => ({ userId: fixtureId(1) }),
      useParticipantProfile: (...args: unknown[]) => {
        profiles.push(args);
        return {
          data: {
            fullName: "Partner",
            avatarUrl: "https://fixture.test/avatar",
          },
        };
      },
    },
    "../hooks/use-conversation-context": {
      useConversationContext: (...args: unknown[]) => {
        topics.push(args);
        return { label: "Skill", reference: "Proposal" };
      },
    },
    "./ConversationCard": { ConversationCard: "Card" },
  };
  const contexts = Object.entries(mocks).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  try {
    delete local.cache[filename];
    const { ConversationRow } = local(filename);
    const conversation = {
      id: fixtureId(10),
      participantAId: fixtureId(1),
      participantBId: fixtureId(2),
    };
    const props = {
      item: {
        conversation,
        preview: "Message",
        activityAt: "2026-10-23T00:00:00Z",
      },
    };
    ConversationRow(props);
    focused = false;
    const result = ConversationRow(props);
    assert.deepEqual(profiles, [
      [fixtureId(2), true],
      [fixtureId(2), false],
    ]);
    assert.deepEqual(
      topics.map((args) => args.slice(1)),
      [
        [false, true],
        [false, false],
      ],
    );
    assert.equal(result.props.name, "Partner");
    assert.equal(result.props.preview, "Message");
  } finally {
    delete local.cache[filename];
    contexts.reverse().forEach((context) => context.restore());
  }
});
