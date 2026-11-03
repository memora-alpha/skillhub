import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import { QueryClient } from "@tanstack/react-query";
import { fixtureId } from "./fixtures/learning-requests-data";

test("request inbox loads previews only for that request, keeps each participant conversation, and disables reads on blur", async () => {
  const local = createRequire(
    new URL(
      "../src/features/messages/hooks/use-conversation-inbox.ts",
      import.meta.url,
    ),
  );
  const filename = local.resolve("./use-conversation-inbox.ts");
  const cache = new QueryClient();
  const request = fixtureId(20),
    other = fixtureId(21),
    userId = fixtureId(1);
  const conversations = [request, other, request, null].map((requestId, n) => ({
    id: fixtureId(40 + n),
    proposalId: fixtureId(70 + n),
    learningRequestId: requestId,
    participantAId: userId,
    participantBId: fixtureId(2 + n),
    createdAt: "2030-01-01T00:00:00Z",
  }));
  let focused = true;
  let queries: {
    enabled: boolean;
    queryFn: (context: { signal: AbortSignal }) => Promise<unknown>;
  }[] = [];
  const reads: string[] = [];
  const runtime = {
    key: ["connections", userId, 1],
    userId,
    enabled: true,
    isCurrent: () => true,
  };
  const mocks = {
    react: { useEffect() {}, useCallback: (fn: unknown) => fn },
    "expo-router": { useIsFocused: () => focused },
    "@tanstack/react-query": {
      useQueryClient: () => cache,
      useQueries: (options: { queries: typeof queries }) => {
        queries = options.queries;
        return queries.map(() => ({
          data: { message: null, unread: false },
          isPending: false,
        }));
      },
    },
    "@/features/connections": {
      useConnections: () => runtime,
      useConnectionRefresh() {},
    },
    "./use-messages-api": {
      useConversations: () => ({ items: conversations }),
      useMessagesApi: () => ({
        history: async (id: string) => {
          reads.push(id);
          return { items: [] };
        },
      }),
    },
    "../context/ChatOutbox": { useChatOutboxEntries: () => [] },
    "@/lib/query/use-quiet-read-recovery": {
      isTransientReadError: () => false,
      useQuietReadRecovery() {},
    },
  };
  const handles = Object.entries(mocks).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  try {
    delete local.cache[filename];
    const { useConversationInbox } = local(
      filename,
    ) as typeof import("../src/features/messages/hooks/use-conversation-inbox");
    const result = useConversationInbox({ learningRequestId: request });
    assert.deepEqual(
      result.items.map((i) => i.conversation.id),
      [fixtureId(40), fixtureId(42)],
    );
    assert.equal(queries.length, 2);
    await Promise.all(
      queries.map((q) => q.queryFn({ signal: new AbortController().signal })),
    );
    assert.deepEqual(reads, [fixtureId(40), fixtureId(42)]);
    focused = false;
    useConversationInbox({ learningRequestId: request });
    assert.ok(queries.every((q) => !q.enabled));
  } finally {
    cache.clear();
    delete local.cache[filename];
    handles.reverse().forEach((h) => h.restore());
  }
});
