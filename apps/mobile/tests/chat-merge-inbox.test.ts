import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import { QueryClient } from "@tanstack/react-query";
import { fixtureId } from "./fixtures/learning-requests-data";
import type { ApiMessage } from "../src/features/messages/api/messages-api";
import type { QueuedText } from "../src/features/messages/outbox/outbox-types";

test("merged inbox keeps unread evidence, queued previews and denial isolation on the shared SSE key", async () => {
  const local = createRequire(
    new URL(
      "../src/features/messages/hooks/use-conversation-inbox.ts",
      import.meta.url,
    ),
  );
  const filename = local.resolve("./use-conversation-inbox");
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const viewer = fixtureId(1),
    partner = fixtureId(2),
    conversationId = fixtureId(3);
  const base = ["connections", viewer];
  const conversation = {
    id: conversationId,
    proposalId: fixtureId(4),
    learningRequestId: null,
    participantAId: viewer,
    participantBId: partner,
    createdAt: "2030-01-01T00:00:00Z",
  };
  const incoming: ApiMessage = {
    id: fixtureId(10),
    conversationId,
    senderId: partner,
    messageText: "Chào bạn",
    messageType: "TEXT",
    attachments: [],
    sequence: "1",
    sentAt: "2030-01-02T00:00:00Z",
    readAt: null,
  };
  const outgoing: ApiMessage = {
    ...incoming,
    id: fixtureId(11),
    senderId: viewer,
    messageText: "Chào đối tác",
    sequence: "2",
  };
  let queued: QueuedText[] = [];
  let failedRead = false;
  let requestedLimit: number | undefined;
  let configurations: {
    queryKey: unknown[];
    queryFn: (input: { signal: AbortSignal }) => Promise<unknown>;
    meta: Record<string, unknown>;
  }[] = [];
  const mocks = {
    react: { useCallback: (callback: unknown) => callback },
    "@tanstack/react-query": {
      useQueryClient: () => cache,
      useQueries: ({ queries }: { queries: typeof configurations }) => {
        configurations = queries;
        return queries.map(({ queryKey }) => ({
          data: cache.getQueryData(queryKey),
          error: failedRead ? new Error("offline") : undefined,
          isPending: !cache.getQueryData(queryKey),
        }));
      },
    },
    "@/features/connections": {
      useConnections: () => ({
        key: base,
        userId: viewer,
        enabled: true,
        isCurrent: () => true,
      }),
      useConnectionRefresh: () => {},
    },
    "./use-messages-api": {
      useConversations: () => ({
        items: [conversation],
        denied: false,
        refetch: async () => {},
      }),
      useMessagesApi: () => ({
        history: async (_id: string, options: { limit?: number }) => {
          requestedLimit = options.limit;
          return { items: [incoming, outgoing] };
        },
      }),
    },
    "../context/ChatOutbox": { useChatOutboxEntries: () => queued },
  };
  const contexts = Object.entries(mocks).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  try {
    delete local.cache[filename];
    const { useConversationInbox } = local(filename) as {
      useConversationInbox: () => {
        items: { preview: string; unread?: boolean; state?: string }[];
      };
    };
    useConversationInbox();
    const configuration = configurations[0]!;
    assert.deepEqual(configuration.queryKey, [
      ...base,
      "conversations",
      "preview",
      conversationId,
    ]);
    await cache.fetchQuery(configuration);
    assert.equal(
      requestedLimit,
      undefined,
      "read the newest page so an incoming unread before an outgoing is retained",
    );
    let row = useConversationInbox().items[0]!;
    assert.equal(row.unread, true);
    assert.equal(row.preview, "Bạn: Chào đối tác");
    queued = [
      {
        clientMessageId: fixtureId(12),
        conversationId,
        messageText: "Tin chờ gửi",
        createdAt: "2030-01-03T00:00:00Z",
        state: "failed",
        phase: "check",
        attempts: 1,
        retryAt: 0,
      },
    ];
    row = useConversationInbox().items[0]!;
    assert.equal(row.preview, "Bạn: Tin chờ gửi");
    assert.equal(row.state, "failed");
    assert.equal(row.unread, true);
    failedRead = true;
    assert.equal(useConversationInbox().items[0]!.unread, false);
    const access = cache
      .getQueryCache()
      .find({ queryKey: configuration.queryKey, exact: true })!.meta!
      .connectionReadAccess as { denied: boolean };
    access.denied = true;
    row = useConversationInbox().items[0]!;
    assert.equal(row.preview, "Không tải được tin nhắn");
    assert.equal(row.state, undefined);
    assert.equal(row.unread, undefined);
  } finally {
    delete local.cache[filename];
    contexts.forEach((context) => context.restore());
    cache.clear();
  }
});
