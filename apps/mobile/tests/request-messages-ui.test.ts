import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import { fixtureId } from "./fixtures/learning-requests-data";
import type { RequestInboxGroup } from "../src/features/messages/utils/inbox-groups";
import { AppError } from "../src/lib/http/errors";

type Node = {
  type: string | ((props: Record<string, unknown>) => unknown);
  props: Record<string, unknown>;
};
function nodes(value: unknown): Node[] {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value || typeof value !== "object" || !("type" in value)) return [];
  const node = value as Node;
  if (typeof node.type === "function") return nodes(node.type(node.props));
  const children =
    typeof node.props.children === "function"
      ? node.props.children()
      : node.props.children;
  return [node, ...nodes(children)];
}

test("request tabs use the viewer's proposal role even when the title is unavailable", () => {
  const local = createRequire(
    new URL(
      "../src/features/messages/screens/RequestMessagesScreen.tsx",
      import.meta.url,
    ),
  );
  const filename = local.resolve("./RequestMessagesScreen.tsx");
  let params: Record<string, unknown> = { id: fixtureId(20) };
  let readDenied: string | undefined;
  let linked: Record<string, unknown> | undefined;
  let request: Record<string, unknown> = {
    id: fixtureId(20),
    title: "React request",
  };
  const jsx = (type: Node["type"], props: Node["props"]) => ({ type, props });
  const mocks = {
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "react-native": {
      View: "View",
      StyleSheet: { create: (value: unknown) => value },
    },
    "expo-router": {
      useLocalSearchParams: () => params,
      useRouter: () => ({
        setParams: (patch: object) => {
          params = { ...params, ...patch };
        },
      }),
    },
    "@/features/shell": { AppScreenLayout: "Layout" },
    "@/features/learning-requests": {
      useRequestDetail: () => ({ data: request, readDenied, isPending: false }),
    },
    "@/features/proposals": {
      ReceivedRequestProposals: "Received",
      ProposalListCard: "Sent",
    },
    "@/features/proposals/state": {
      useProposal: (id: string) => ({ data: id ? linked : undefined }),
      useSentRequestProposals: () => ({}),
    },
    "@/features/connections": {
      useConnections: () => ({ userId: fixtureId(1) }),
      ConnectionFeedback: "Feedback",
    },
    "@/components/EmptyState": { EmptyState: "Empty" },
    "../components/RequestMessageTabs": { RequestMessageTabs: "Tabs" },
    "../components/RequestChatsContent": { RequestChatsContent: "Chats" },
  };
  const handles = Object.entries(mocks).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  try {
    delete local.cache[filename];
    const { RequestMessagesScreen } = local(
      filename,
    ) as typeof import("../src/features/messages/screens/RequestMessagesScreen");
    const render = () => nodes(RequestMessagesScreen());
    let tree = render();
    const received = tree.find((n) => n.type === "Received")!;
    assert.equal(received.props.requestId, fixtureId(20));
    assert.equal(received.props.status, "PENDING");
    (received.props.onStatusChange as (v: string) => void)("REJECTED");
    tree = render();
    assert.equal(
      tree.find((n) => n.type === "Received")?.props.status,
      "REJECTED",
    );
    (
      tree.find((n) => n.type === "Tabs")!.props.onChange as (v: string) => void
    )("chats");
    tree = render();
    assert.equal(
      tree.some((n) => n.type === "Received"),
      false,
    );
    assert.equal(
      tree.find((n) => n.type === "Chats")?.props.requestId,
      fixtureId(20),
    );
    (
      tree.find((n) => n.type === "Tabs")!.props.onChange as (v: string) => void
    )("received");
    assert.equal(
      render().find((n) => n.type === "Received")?.props.status,
      "REJECTED",
    );
    readDenied = "forbidden";
    tree = render();
    assert.equal(
      tree.find((n) => n.type === "Received")?.props.requestId,
      fixtureId(20),
    );
    assert.equal(
      tree.find((n) => n.type === "Layout")?.props.title,
      `Yêu cầu #${fixtureId(20).slice(-8).toUpperCase()}`,
    );
    readDenied = undefined;
    request = { ...request, owner: { id: fixtureId(2) } };
    assert.equal(
      render().some((n) => n.type === "Received"),
      false,
    );
    assert.equal(
      render().find((n) => n.type === "Tabs")?.props.direction,
      "sent",
    );
    params = { ...params, proposalId: fixtureId(70) };
    linked = { learningRequestId: fixtureId(20), proposerId: fixtureId(1) };
    readDenied = "missing";
    assert.equal(
      render().find((n) => n.type === "Tabs")?.props.direction,
      "sent",
    );
    assert.equal(
      render().find((n) => n.type === "Sent")?.props.proposal,
      linked,
    );
    linked = { ...linked, learningRequestId: fixtureId(21) };
    assert.equal(
      render().some((n) => n.type === "Sent"),
      false,
    );
    params = { id: [fixtureId(20)] };
    assert.equal(
      render().some((n) => n.type === "Tabs"),
      false,
    );
  } finally {
    delete local.cache[filename];
    handles.forEach((h) => h.restore());
  }
});

test("proposal tabs show exactly two text labels without counts and select the requested view", () => {
  const local = createRequire(
    new URL(
      "../src/features/messages/components/RequestMessageTabs.tsx",
      import.meta.url,
    ),
  );
  const filename = local.resolve("./RequestMessageTabs.tsx");
  const jsx = (type: Node["type"], props: Node["props"]) => ({ type, props });
  const handles = [
    mock.module(pathToFileURL(local.resolve("react/jsx-runtime")), {
      namedExports: { jsx, jsxs: jsx },
    }),
    mock.module(pathToFileURL(local.resolve("react-native")), {
      namedExports: {
        View: "View",
        Text: "Text",
        Pressable: "Button",
        StyleSheet: { create: (v: unknown) => v },
      },
    }),
  ];
  try {
    delete local.cache[filename];
    const { RequestMessageTabs } = local(
      filename,
    ) as typeof import("../src/features/messages/components/RequestMessageTabs");
    let selected = "";
    const tree = nodes(
      RequestMessageTabs({
        value: "received",
        onChange: (value) => {
          selected = value;
        },
      }),
    );
    assert.deepEqual(
      tree.filter((n) => n.type === "Text").map((n) => n.props.children),
      ["Đề xuất nhận được", "Đoạn chat"],
    );
    const buttons = tree.filter((n) => n.type === "Button");
    const [received, chats] = buttons;
    assert.ok(received && chats);
    assert.equal(received.props["aria-selected"], true);
    assert.equal(chats.props["aria-selected"], false);
    (chats.props.onPress as () => void)();
    assert.equal(selected, "chats");
  } finally {
    delete local.cache[filename];
    handles.forEach((h) => h.restore());
  }
});

test("rejected proposal history uses the server request filter and keeps the request when opening its card", () => {
  const local = createRequire(
    new URL(
      "../src/features/proposals/components/ReceivedRequestProposals.tsx",
      import.meta.url,
    ),
  );
  const filename = local.resolve("./ReceivedRequestProposals.tsx");
  const calls: unknown[][] = [];
  let error: AppError | undefined;
  const item = { id: fixtureId(70), status: "REJECTED" };
  const jsx = (type: Node["type"], props: Node["props"]) => ({ type, props });
  const mocks = {
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "react-native": { View: "View", StyleSheet: { create: (v: unknown) => v } },
    "expo-router": { useIsFocused: () => true },
    "@/components/RefreshableFlatList": { RefreshableFlatList: "List" },
    "@/components/feature-page": { ui: { page: {} } },
    "@/components/Button": { Button: "Button" },
    "@/components/EmptyState": { EmptyState: "Empty" },
    "@/features/connections": { ConnectionFeedback: "Feedback" },
    "../hooks/use-proposals-api": {
      useProposalList: (...args: unknown[]) => {
        calls.push(args);
        return { data: {}, items: [item], isPending: false, error };
      },
    },
    "./ProposalListCard": { ProposalListCard: "Card" },
    "./ProposalListFilters": { ProposalListFilters: "Filters" },
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
    const { ReceivedRequestProposals } = local(
      filename,
    ) as typeof import("../src/features/proposals/components/ReceivedRequestProposals");
    let selected = "";
    let openedChats = false;
    const render = () =>
      ReceivedRequestProposals({
        requestId: fixtureId(20),
        status: "REJECTED",
        onStatusChange: (value) => {
          selected = value;
        },
        onOpenChats: () => {
          openedChats = true;
        },
      }) as unknown as Node;
    const tree = nodes(render()).find((n) => n.type === "List")!;
    assert.deepEqual(calls, [["received", "REJECTED", fixtureId(20), true]]);
    const header = nodes(tree.props.ListHeaderComponent);
    const filter = header.find((n) => n.type === "Filters")!;
    assert.equal(filter.props.statusOnly, true);
    (filter.props.onChange as (v: string) => void)("all");
    assert.equal(selected, "all");
    const card = (tree.props.renderItem as (v: { item: typeof item }) => Node)({
      item,
    });
    assert.equal(card.props.returnRequestId, fixtureId(20));
    assert.equal(card.props.compact, true);
    error = new AppError("http", 404);
    const notice = nodes(render());
    assert.equal(
      notice.some((n) => n.type === "List"),
      false,
    );
    (notice.find((n) => n.type === "Empty")?.props.onAction as () => void)();
    assert.equal(openedChats, true);
  } finally {
    delete local.cache[filename];
    handles.reverse().forEach((h) => h.restore());
  }
});

test("request card matches the three-line design, counts all proposal history, attributes incoming previews and opens the request screen", () => {
  const local = createRequire(
    new URL(
      "../src/features/messages/components/RequestInboxCard.tsx",
      import.meta.url,
    ),
  );
  const filename = local.resolve("./RequestInboxCard.tsx");
  const userId = fixtureId(1),
    peerId = fixtureId(2),
    requestId = fixtureId(20);
  const routes: unknown[] = [];
  const skillId = fixtureId(30);
  let requestRead: {
    data?: { title: string; owner?: { id: string } };
    readDenied?: string;
    isPending: boolean;
  } = {
    data: { title: "Học React cơ bản" },
    isPending: false,
  };
  let contextRequestId = requestId;
  let contextProposerId = peerId;
  const group: RequestInboxGroup = {
    kind: "request",
    id: requestId,
    activityAt: "2030-01-01T00:00:00Z",
    preview: "Mình gửi lộ trình rồi nhé!",
    hasPending: true,
    hasChat: true,
    unread: true,
    receivedCount: 5,
    pendingCount: 1,
    chatCount: 3,
    receivedCountExact: true,
    chatCountExact: true,
    contextProposalId: fixtureId(70),
    latestConversation: {
      conversation: {
        id: fixtureId(40),
        proposalId: fixtureId(70),
        learningRequestId: requestId,
        participantAId: userId,
        participantBId: peerId,
        createdAt: "2030-01-01T00:00:00Z",
      },
      preview: "Mình gửi lộ trình rồi nhé!",
      previewSenderId: peerId,
      activityAt: "2030-01-01T00:00:00Z",
    },
  };
  const jsx = (type: Node["type"], props: Node["props"]) => ({ type, props });
  const mocks = {
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "react-native": {
      View: "View",
      Text: "Text",
      Pressable: "Card",
      StyleSheet: { create: (v: unknown) => v },
    },
    "expo-router": {
      useIsFocused: () => true,
      useRouter: () => ({ push: (route: unknown) => routes.push(route) }),
    },
    "@/features/learning-requests": {
      useRequestDetail: () => requestRead,
    },
    "@/features/connections": {
      useConnections: () => ({ userId }),
      useCatalogName: (id: string | undefined) => ({
        data: id === skillId ? "React" : undefined,
      }),
      useParticipantProfile: () => ({
        data: { userId: peerId, fullName: "Nguyễn Minh An" },
      }),
    },
    "@/features/proposals/state": {
      useProposal: (id: string) => ({
        data: id
          ? {
              learningRequestId: contextRequestId,
              skillId,
              proposerId: contextProposerId,
            }
          : undefined,
      }),
    },
    "@/components/Icon": { Icon: "Icon" },
  };
  const handles = Object.entries(mocks).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  try {
    delete local.cache[filename];
    const { RequestInboxCard } = local(
      filename,
    ) as typeof import("../src/features/messages/components/RequestInboxCard");
    const render = () => nodes(RequestInboxCard({ group }));
    let tree = render();
    assert.deepEqual(
      tree.filter((n) => n.type === "Text").map((n) => n.props.children),
      [
        "Học React cơ bản",
        "5 đề xuất nhận được · 3 đoạn chat",
        "An: Mình gửi lộ trình rồi nhé!",
      ],
    );
    (tree.find((n) => n.type === "Card")!.props.onPress as () => void)();
    assert.deepEqual(routes, [
      {
        pathname: "/messages/request/[id]",
        params: { id: requestId, view: "received", proposalId: fixtureId(70) },
      },
    ]);
    group.latestConversation!.previewSenderId = userId;
    group.preview = "Bạn: Mình rảnh tối thứ Tư.";
    tree = render();
    assert.equal(
      tree.filter((n) => n.type === "Text").at(-1)?.props.children,
      "Bạn: Mình rảnh tối thứ Tư.",
    );
    group.receivedCountExact = false;
    assert.equal(
      render().filter((n) => n.type === "Text")[1]?.props.children,
      "5+ đề xuất nhận được · 3 đoạn chat",
    );
    requestRead = {
      data: { title: "Học React cơ bản" },
      readDenied: "forbidden",
      isPending: false,
    };
    assert.equal(
      render().filter((n) => n.type === "Text")[0]?.props.children,
      "React",
    );
    assert.equal(
      render().filter((n) => n.type === "Text")[1]?.props.children,
      `#${requestId.slice(-8).toUpperCase()}`,
    );
    contextRequestId = fixtureId(21);
    assert.equal(
      render().filter((n) => n.type === "Text")[0]?.props.children,
      "Chưa đọc được tên bài",
    );
    requestRead = { isPending: false };
    assert.equal(
      render().filter((n) => n.type === "Text")[0]?.props.children,
      "Chưa đọc được tên bài",
    );
    group.receivedCount = 0;
    group.receivedCountExact = true;
    assert.ok(render().some((n) => n.props.children === "3 đoạn chat"));
    requestRead = {
      data: { title: "Bài của người khác", owner: { id: peerId } },
      isPending: false,
    };
    assert.ok(
      render().some((n) => n.props.children === "Đã gửi đề xuất · 3 đoạn chat"),
    );
    requestRead = { readDenied: "missing", isPending: false };
    contextRequestId = requestId;
    contextProposerId = userId;
    assert.ok(
      render().some((n) => n.props.children === "Đã gửi đề xuất · 3 đoạn chat"),
    );
  } finally {
    delete local.cache[filename];
    handles.reverse().forEach((h) => h.restore());
  }
});
