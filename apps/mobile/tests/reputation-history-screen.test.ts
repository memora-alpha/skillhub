import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import { reputationHistoryGroups } from "../src/features/community/utils/reputation-history";
import type { Reputation } from "../src/features/community/api/community-api";
import { fixtureId } from "./fixtures/learning-requests-data";

function row(
  index: number,
  delta: number,
  at = new Date().toISOString(),
): Reputation["items"][number] {
  return {
    id: fixtureId(index),
    userId: fixtureId(1),
    scoreBefore: 50,
    scoreAfter: 50 + delta,
    delta,
    reasonCode: delta > 0 ? "PATH_COMPLETED" : "NO_SHOW",
    sourceType: "LEARNING_PATH",
    sourceId: fixtureId(index + 100),
    createdAt: at,
  };
}

test("history groups consecutive pages by local day without reordering or altering server events", () => {
  const now = new Date(2026, 10, 8, 14);
  const today = new Date(2026, 10, 8, 10).toISOString();
  const yesterday = new Date(2026, 10, 7, 12).toISOString();
  const items = [row(10, 3, today), row(11, -5, today), row(12, 2, yesterday)];
  const original = structuredClone(items);
  const groups = reputationHistoryGroups(items, now);
  assert.deepEqual(
    groups.map((group) => group.label),
    ["Hôm nay", "Hôm qua"],
  );
  assert.deepEqual(
    groups.flatMap((group) => group.items.map((item) => item.id)),
    items.map((item) => item.id),
  );
  assert.deepEqual(items, original);
});

type Element = { type: unknown; props: Record<string, unknown> };
function expand(tree: unknown): unknown {
  if (Array.isArray(tree)) return tree.map(expand);
  if (!tree || typeof tree !== "object" || !("props" in tree)) return tree;
  const el = tree as Element;
  return typeof el.type === "function"
    ? expand(el.type(el.props))
    : { ...el, props: { ...el.props, children: expand(el.props.children) } };
}
function elements(tree: unknown): Element[] {
  if (Array.isArray(tree)) return tree.flatMap(elements);
  if (!tree || typeof tree !== "object" || !("props" in tree)) return [];
  const el = tree as Element;
  return [el, ...elements(el.props.children)];
}
function text(tree: unknown): string {
  if (typeof tree === "string" || typeof tree === "number") return String(tree);
  if (Array.isArray(tree)) return tree.map(text).join("");
  return tree && typeof tree === "object" && "props" in tree
    ? text((tree as Element).props.children)
    : "";
}

test("history screen shows score and signed events, keeps only load-more, and exposes no refresh/unrelated/policy actions", () => {
  const local = createRequire(
    new URL(
      "../src/features/community/screens/reputation-screens.tsx",
      import.meta.url,
    ),
  );
  const files = [
    local.resolve("./reputation-screens.tsx"),
    local.resolve("../components/reputation-history.tsx"),
    local.resolve("../components/reputation-score-card.tsx"),
    local.resolve("../components/reputation-summary.tsx"),
  ];
  let pages = 0;
  const data: Reputation = {
    reputationScore: 25,
    level: "LOW",
    activeRestrictions: [],
    policyNotice: ["Quy tắc cần xác nhận"],
    items: [row(10, 3), row(11, -5)],
    nextCursor: fixtureId(11),
  };
  const policy = {
    data: data as Reputation | undefined,
    pending: false,
    acknowledged: false,
    needsCheck: false,
    error: undefined,
    query: {
      items: data.items,
      hasNextPage: true,
      isLoading: false,
      isFetching: false,
      isRefetching: false,
      denied: false,
      error: null,
      fetchNextPage: async () => {
        pages++;
      },
    },
    refresh: async () => {},
    acknowledge: async () => {
      throw Error("history must not acknowledge");
    },
  };
  const jsx = (type: unknown, props: unknown) => ({ type, props });
  const contexts = Object.entries({
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "Fragment" },
    "react-native": {
      Text: "Text",
      View: "View",
      StyleSheet: { create: (value: unknown) => value },
    },
    "@/components/Button": { Button: "Button" },
    "@/components/Badge": { Badge: "Badge" },
    "@/components/feature-page": {
      FeaturePage: "Page",
      RouteButton: "RouteButton",
    },
    "@/features/connections": { ConnectionFeedback: "Feedback" },
    "../hooks/use-reputation-policy": { useReputationPolicy: () => policy },
    "../components/reputation-policy-content": {
      ReputationPolicyContent: "PolicyContent",
    },
  }).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  try {
    files.forEach((file) => {
      delete local.cache[file];
    });
    const { ReputationHistoryScreen } = local(
      files[0]!,
    ) as typeof import("../src/features/community/screens/reputation-screens");
    const render = () => expand(ReputationHistoryScreen());
    let tree = render();
    assert.match(text(tree), /Hoàn thành lộ trình/);
    assert.match(text(tree), /\+3/);
    assert.match(text(tree), /-5/);
    assert.doesNotMatch(
      text(tree),
      /Làm mới|Danh hiệu|danh hiệu|Báo cáo|báo cáo|Tôi đã đọc/,
    );
    assert.equal(
      elements(tree).some(
        (el) => el.type === "PolicyContent" || el.type === "RouteButton",
      ),
      false,
    );
    const buttons = elements(tree).filter((el) => el.type === "Button");
    assert.equal(buttons.length, 1);
    assert.equal(text(buttons[0]!.props.children), "Xem thêm lịch sử");
    (buttons[0]!.props.onPress as () => void)();
    assert.equal(pages, 1);
    policy.query.hasNextPage = false;
    policy.query.items = [];
    tree = render();
    assert.match(text(tree), /Chưa có thay đổi điểm/);
    assert.equal(elements(tree).filter((el) => el.type === "Button").length, 0);
    policy.data = undefined;
    policy.query.denied = true;
    tree = render();
    assert.match(text(tree), /hiện không khả dụng/);
    assert.doesNotMatch(
      text(tree),
      /Chưa có thay đổi điểm|Hoàn thành lộ trình/,
    );
  } finally {
    files.forEach((file) => {
      delete local.cache[file];
    });
    contexts.reverse().forEach((context) => context.restore());
  }
});
