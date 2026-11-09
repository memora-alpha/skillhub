import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import {
  overviewFixture,
  participantCaseFixture,
} from "./fixtures/path-overview";
import { agreementPath } from "./fixtures/learning-agreement";

type Element = {
  type: string | ((props: Record<string, unknown>) => unknown);
  props: Record<string, unknown>;
};
function expand(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(expand);
  if (!value || typeof value !== "object" || !("props" in value)) return value;
  const node = value as Element;
  if (typeof node.type === "function") return expand(node.type(node.props));
  return {
    ...node,
    props: { ...node.props, children: expand(node.props.children) },
  };
}
function nodes(value: unknown): Element[] {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value || typeof value !== "object" || !("props" in value)) return [];
  const node = value as Element;
  return [node, ...nodes(node.props.children)];
}
function text(value: unknown): string {
  if (Array.isArray(value)) return value.map(text).join(" ");
  if (value && typeof value === "object" && "props" in value)
    return text((value as Element).props.children);
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : "";
}
function harness(file: string) {
  const local = createRequire(
    new URL(`../src/features/learning-paths/${file}.tsx`, import.meta.url),
  );
  const filename = local.resolve(`./${file.split("/").at(-1)}.tsx`);
  const view = overviewFixture();
  const query = {
    data: view as typeof view | undefined,
    denied: false,
    isLoading: false,
    isFetching: false,
    error: undefined as unknown,
    refetch: mock.fn(),
  };
  const jsx = (type: unknown, props: unknown) => ({ type, props });
  const mocks = {
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "Fragment" },
    "react-native": {
      View: "View",
      Text: "Text",
      StyleSheet: { create: (styles: unknown) => styles },
    },
    "@/components/feature-page": { Copy: "Copy", RouteButton: "RouteButton" },
    "@/components/learning-flow": { FlowSection: "Section", FlowPage: "Page" },
    "expo-router": {
      useLocalSearchParams: () => ({
        id: view.settlement.pathId,
        caseId: participantCaseFixture().id,
      }),
    },
    "@/components/FormNotice": { FormNotice: "Notice" },
    "../components/PathReadFeedback": { PathReadFeedback: "Feedback" },
    "@/components/EmptyState": { EmptyState: "EmptyState" },
    "../hooks/use-path-overview": {
      usePathOverview: () => query,
      usePathCaseSummary: () => ({
        ...query,
        data: { ...participantCaseFixture(), attention: view.primaryAttention },
      }),
    },
  };
  const contexts = Object.entries(mocks).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  delete local.cache[filename];
  const module = local(filename) as Record<
    string,
    (props: Record<string, unknown>) => unknown
  >;
  return {
    query,
    render: (name: string, props: Record<string, unknown>) =>
      expand(module[name]!(props)),
    close() {
      delete local.cache[filename];
      contexts.reverse().forEach((context) => context.restore());
    },
  };
}
test("overview displays server stage, separate learning/teaching counts and next-session role", () => {
  const h = harness("components/path-overview-summary");
  try {
    const tree = h.render("PathOverviewSummary", {
      overview: overviewFixture(),
    });
    assert.match(text(tree), /Đang học/);
    assert.match(text(tree), /Bạn học\s*1\s*\/\s*3/);
    assert.match(text(tree), /Bạn dạy\s*2\s*\/\s*4/);
    assert.match(text(tree), /Buổi tiếp theo · Bạn\s+học/);
    assert.equal(
      nodes(tree).filter((node) => node.type === "RouteButton").length,
      0,
      "the summary leaves navigation to the full session-list action",
    );
    const incomplete = h.render("PathOverviewSummary", {
      overview: {
        ...overviewFixture(),
        learningStage: null,
        nextSession: null,
      },
    });
    assert.doesNotMatch(
      text(incomplete),
      /chưa đầy đủ|Chưa xác định|Chưa có buổi học/,
    );
    assert.match(text(incomplete), /Bạn học\s*1\s*\/\s*3/);
    assert.equal(
      h.render("PathOverviewSummary", {
        overview: {
          ...overviewFixture(),
          learningStage: null,
          nextSession: null,
          progress: { learning: null, teaching: null, basis: "CURRENT_PLAN" },
        },
      }),
      null,
    );
  } finally {
    h.close();
  }
});
test("case summary uses the header Back and omits redundant agreement and generic help buttons", () => {
  const h = harness("screens/path-case-summary-screen");
  try {
    const tree = h.render("PathCaseSummaryScreen", {});
    assert.doesNotMatch(text(tree), /Xem thỏa thuận và quyết toán|Trợ giúp/);
    assert.equal(
      nodes(tree).find((node) => node.type === "Page")?.props.backBehavior,
      "history",
    );
    assert.equal(
      nodes(tree).find((node) => node.type === "Page")?.props.back,
      `/paths/${overviewFixture().settlement.pathId}/cases`,
    );
  } finally {
    h.close();
  }
});
test("settlement links counterpart/system case summaries, deduplicates targets and handles older responses", () => {
  const h = harness("components/settlement-related-items"),
    view = overviewFixture();
  try {
    const tree = h.render("SettlementRelatedItems", {
      status: view.settlement,
    });
    const links = nodes(tree).filter((node) => node.type === "RouteButton");
    assert.equal(links.length, 1);
    assert.equal(
      links[0]!.props.href,
      `/paths/${view.settlement.pathId}/cases/${view.primaryAttention!.target.id}`,
    );
    const legacy = h.render("SettlementRelatedItems", {
      status: {
        ...view.settlement,
        nextActionTarget: undefined,
        relatedItems: undefined,
      },
    });
    assert.equal(
      nodes(legacy).filter((node) => node.type === "RouteButton").length,
      0,
    );
    assert.ok(!nodes(legacy).some((node) => node.props.href === "/reports"));
  } finally {
    h.close();
  }
});
test("participant summary never presents reporter-only actions or a resolved case as currently blocking", () => {
  const h = harness("components/participant-case-card");
  try {
    const tree = h.render("ParticipantCaseCard", {
      item: { ...participantCaseFixture(), status: "RESOLVED" },
      detail: true,
    });
    assert.match(text(tree), /Đã giải quyết/);
    assert.doesNotMatch(text(tree), /đang chặn/);
    assert.equal(
      nodes(tree).filter((node) => node.type === "RouteButton").length,
      1,
    );
    assert.ok(
      nodes(tree).some(
        (node) =>
          node.props.href ===
          `/paths/${participantCaseFixture().relatedPathId}/sessions`,
      ),
    );
    const relatedSessionId = overviewFixture().nextSession!.id;
    const linked = h.render("ParticipantCaseCard", {
      item: { ...participantCaseFixture(), relatedSessionId },
      detail: true,
    });
    const links = nodes(linked).filter((node) => node.type === "RouteButton");
    assert.equal(links.length, 2);
    assert.ok(
      links.some(
        (node) =>
          node.props.href === `/learning-sessions/${relatedSessionId}` &&
          text(node).includes("buổi học của vụ việc"),
      ),
    );
    assert.ok(
      links.some(
        (node) =>
          node.props.href ===
            `/paths/${participantCaseFixture().relatedPathId}/sessions` &&
          text(node).includes("tất cả buổi học"),
      ),
    );
  } finally {
    h.close();
  }
});
test("overview denial hides both cached and embedded snapshots", () => {
  const h = harness("components/path-overview-panel"),
    path = agreementPath();
  try {
    const props = {
      path: {
        ...path,
        overview: overviewFixture(),
        attentionItems: overviewFixture().attentionItems,
      },
    };
    const content = h.render("PathOverviewPanel", props);
    assert.match(text(content), /Bạn học/);
    assert.match(text(content), /1\s*việc cần theo dõi/);
    assert.doesNotMatch(
      text(content),
      /Xem tóm tắt vụ việc|Xem buổi học và thao tác|Xem buổi học tiếp theo|Vắng mặt hoặc trễ nghiêm trọng/,
    );
    assert.equal(
      nodes(content).filter((node) => node.type === "RouteButton").length,
      0,
    );
    h.query.data = {
      ...overviewFixture(),
      attentionCount: 3,
      attentionItems: [
        ...overviewFixture().attentionItems,
        {
          ...overviewFixture().attentionItems[0]!,
          key: "session:one",
          type: "SESSION",
          reasonCode: "SESSION_AWAITING_CONFIRMATION",
        },
        {
          ...overviewFixture().attentionItems[0]!,
          key: "session:two",
          type: "SESSION",
          reasonCode: "SESSION_MAKEUP_REQUIRED",
        },
      ],
    };
    const multiple = h.render("PathOverviewPanel", props);
    assert.match(text(multiple), /3\s*việc cần theo dõi/);
    assert.doesNotMatch(
      text(multiple),
      /Xem tóm tắt|Xem buổi học và thao tác|Buổi học chờ xác nhận|Buổi học cần học bù/,
    );
    assert.equal(
      nodes(multiple).filter((node) => node.type === "RouteButton").length,
      0,
    );
    assert.doesNotMatch(
      text(content),
      /Kiểm tra gần nhất|Không có việc cần xử lý/,
    );
    assert.ok(
      !nodes(content).some(
        (node) => node.props.href === `/paths/${path.id}/cases`,
      ),
    );
    h.query.data = {
      ...overviewFixture(),
      learningStage: null,
      nextSession: null,
      progress: { learning: null, teaching: null, basis: "CURRENT_PLAN" },
      attentionCount: 0,
      primaryAttention: null,
      attentionItems: [],
    };
    assert.ok(
      !nodes(h.render("PathOverviewPanel", { path })).some(
        (node) => node.type === "Section",
      ),
    );
    h.query.data = undefined;
    assert.ok(
      !nodes(h.render("PathOverviewPanel", { path })).some(
        (node) => node.type === "Section",
      ),
    );
    h.query.data = overviewFixture();
    h.query.denied = true;
    const denied = h.render("PathOverviewPanel", props);
    assert.doesNotMatch(text(denied), /Bạn học|Bạn dạy/);
    assert.equal(
      nodes(denied).filter((node) => node.type === "RouteButton").length,
      0,
    );
  } finally {
    h.close();
  }
});
