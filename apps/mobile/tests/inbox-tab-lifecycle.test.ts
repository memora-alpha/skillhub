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
    refetch() {},
  };
  const jsx = (type: unknown, props: unknown) => ({ type, props });
  const mocks = {
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "react-native": {
      View: "View",
      ActivityIndicator: "Loading",
      StyleSheet: { create: (styles: unknown) => styles },
    },
    "expo-router": {
      useRouter: () => ({ push() {} }),
      useIsFocused: () => true,
    },
    "@/features/shell": { AppScreenLayout: "Layout" },
    "@/features/connections": { ConnectionFeedback: "Feedback" },
    "@/components/RefreshableFlatList": { RefreshableFlatList: "FlatList" },
    "@/components/Button": { Button: "Button" },
    "@/components/EmptyState": { EmptyState: "Empty" },
    "@/components/LoadingIndicator": { LoadingIndicator: "Loading" },
    "../components/InboxHeader": { InboxHeader: "Header" },
    "../components/ConversationRow": { ConversationRow: "Row" },
    "../hooks/use-conversation-inbox": { useConversationInbox: () => state },
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
    const render = () => ApiMessagesScreen().props.children();
    const loading = render();
    assert.equal(
      loading.props.ListHeaderComponent.props.children.props.loading,
      true,
    );
    assert.equal(
      loading.props.ListHeaderComponent.props.children.props.error,
      undefined,
    );
    assert.equal(loading.props.ListEmptyComponent, null);
    state.data = { pages: [] };
    const cachedEmpty = render();
    assert.equal(
      cachedEmpty.props.ListHeaderComponent.props.children.props.loading,
      false,
    );
    assert.equal(cachedEmpty.props.ListEmptyComponent.type, "Empty");
    state.items = [{ conversation: { id: fixtureId(1) } }];
    assert.equal(render().props.data, state.items);
    state.error = new AppError("http", 403);
    assert.equal(
      render().props.ListHeaderComponent.props.children.props.error,
      state.error,
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

test("leaving Inbox disables its list/previews and cancels only reads with no other active consumer", async () => {
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
  const items = [10, 11].map((n) => ({
    id: fixtureId(n),
    proposalId: fixtureId(n + 10),
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
    const { useConversationInbox } = local(filename) as {
      useConversationInbox: () => { items: unknown[] };
    };
    const render = () => {
      effects = [];
      const result = useConversationInbox();
      effects.forEach((fn) => fn());
      return result;
    };
    render();
    assert.equal(signals.size, 2);
    // A concurrent consumer must keep the second query alive after Inbox blurs.
    const shared = new QueryObserver(cache, {
      ...observers[1]!.options,
      enabled: true,
    });
    const stopShared = shared.subscribe(() => {});
    stops.push(stopShared);
    focused = false;
    render();
    assert.deepEqual(listEnabled, [true, false]);
    assert.deepEqual(refreshEnabled, [true, false]);
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
      2,
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
