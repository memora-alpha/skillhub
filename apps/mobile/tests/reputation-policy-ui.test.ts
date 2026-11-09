import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test, type TestContext } from "node:test";
import { pathToFileURL } from "node:url";
import type { Reputation } from "../src/features/community/api/community-api";
import { AppError } from "../src/lib/http/errors";

type Element = { type: unknown; props: Record<string, unknown> };
function elements(tree: unknown): Element[] {
  if (Array.isArray(tree)) return tree.flatMap(elements);
  if (!tree || typeof tree !== "object" || !("props" in tree)) return [];
  const el = tree as Element;
  if (typeof el.type === "function") return elements(el.type(el.props));
  return [el, ...elements(el.props.children), ...elements(el.props.footer)];
}
function text(tree: unknown): string {
  if (Array.isArray(tree)) return tree.map(text).join("");
  if (typeof tree === "string" || typeof tree === "number") return String(tree);
  if (!tree || typeof tree !== "object" || !("props" in tree)) return "";
  const el = tree as Element;
  return text(
    typeof el.type === "function" ? el.type(el.props) : el.props.children,
  );
}
function load(t: TestContext) {
  const local = createRequire(
    new URL(
      "../src/features/community/components/reputation-policy-gate.tsx",
      import.meta.url,
    ),
  );
  const files = [
    local.resolve("./reputation-policy-gate.tsx"),
    local.resolve("./reputation-policy-content.tsx"),
    local.resolve("./reputation-summary.tsx"),
  ];
  let open = true,
    acknowledgements = 0,
    refreshes = 0,
    enabled = false;
  const routes: unknown[] = [];
  const data: Reputation = {
    reputationScore: 25,
    level: "LOW",
    activeRestrictions: [
      {
        scope: "CREATE_NEW_ACTIVITY",
        reasonCode: "LOW_REPUTATION",
        endsAt: "2026-01-01T00:00:00Z",
      },
    ],
    policyNotice: ["Xác nhận tham gia trung thực.", "Không tạo hoạt động giả."],
    items: [],
    nextCursor: null,
  };
  const policy = {
    data,
    query: {
      isLoading: false,
      isFetching: false,
      isFetchedAfterMount: true,
      error: undefined as unknown,
    },
    pending: false,
    acknowledged: false,
    needsCheck: false,
    error: undefined as unknown,
    acknowledge: async () => {
      acknowledgements++;
    },
    refresh: async () => {
      refreshes++;
    },
  };
  const jsx = (type: unknown, props: unknown) => ({ type, props });
  const contexts = Object.entries({
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "Fragment" },
    react: {
      useState: () => [
        open,
        (value: boolean) => {
          open = value;
        },
      ],
    },
    "expo-router": {
      useRouter: () => ({ push: (route: unknown) => routes.push(route) }),
    },
    "react-native": {
      View: "View",
      Text: "Text",
      StyleSheet: { create: (value: unknown) => value },
    },
    "@/components/Button": { Button: "Button" },
    "@/components/FormNotice": { FormNotice: "Notice" },
    "@/components/InfoModal": { InfoModal: "Modal" },
    "@/components/Badge": { Badge: "Badge" },
    "@/components/feature-page": {
      Copy: "Copy",
      Panel: "Panel",
      Metric: "Metric",
    },
    "@/features/connections": { ConnectionFeedback: "Feedback" },
    "../hooks/use-reputation-policy": {
      useReputationPolicy: (active: boolean) => {
        enabled = active;
        return policy;
      },
    },
  }).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  files.forEach((file) => {
    delete local.cache[file];
  });
  const { ReputationPolicyGate } = local(
    files[0]!,
  ) as typeof import("../src/features/community/components/reputation-policy-gate");
  t.after(() => {
    files.forEach((file) => {
      delete local.cache[file];
    });
    contexts.reverse().forEach((context) => context.restore());
  });
  return {
    policy,
    routes,
    render() {
      return ReputationPolicyGate({
        message: "Chưa thể đăng yêu cầu học",
        pending: false,
      });
    },
    get acknowledgements() {
      return acknowledgements;
    },
    get refreshes() {
      return refreshes;
    },
    get enabled() {
      return enabled;
    },
  };
}

test("blocked request opens the policy dialog with real rules, reason and missing acknowledgement; dismissing never acknowledges", (t) => {
  const h = load(t),
    tree = h.render();
  assert.equal(h.enabled, true);
  assert.equal(h.acknowledgements, 0);
  assert.match(text(tree), /Xác nhận tham gia trung thực/);
  assert.match(text(tree), /Thời hạn đã qua.*cần xác nhận chính sách/);
  assert.match(text(tree), /Điểm uy tín thấp/);
  const modal = elements(tree).find((el) => el.type === "Modal")!;
  assert.equal(modal.props.title, "Quy định đăng bài");
  assert.equal(modal.props.showConfirm, false);
  (modal.props.onClose as () => void)();
  assert.equal(
    elements(h.render()).find((el) => el.type === "Modal")?.props.title,
    null,
  );
  assert.equal(h.enabled, false);
  assert.equal(h.acknowledgements, 0);
});

test("only the explicit acknowledgement button submits; pending blocks repeated action and modal dismissal", async (t) => {
  const h = load(t);
  const button = elements(h.render()).find(
    (el) =>
      el.type === "Button" &&
      text(el.props.children) === "Tôi đã đọc và hiểu chính sách",
  )!;
  (button.props.onPress as () => void)();
  assert.equal(h.acknowledgements, 1);
  h.policy.pending = true;
  const tree = h.render();
  assert.equal(
    elements(tree).find((el) => el.type === "Modal")?.props.busy,
    true,
  );
  assert.ok(
    elements(tree)
      .filter((el) => el.type === "Button")
      .every((el) => el.props.disabled === true),
  );
  assert.deepEqual(h.routes, []);
});

test("acknowledged policy keeps the remaining restriction visible, while cleared restrictions invite a manual retry", (t) => {
  const h = load(t);
  h.policy.acknowledged = true;
  h.policy.data.policyNotice = null;
  assert.match(text(h.render()), /Tài khoản vẫn đang bị hạn chế/);
  assert.equal(
    elements(h.render()).some(
      (el) =>
        el.type === "Button" &&
        text(el.props.children) === "Tôi đã đọc và hiểu chính sách",
    ),
    false,
  );
  h.policy.data.activeRestrictions = [];
  assert.match(text(h.render()), /chủ động lưu hoặc đăng lại/);
  assert.equal(h.acknowledgements, 0);
  assert.deepEqual(h.routes, []);
});

test("cached reputation from before a blocked POST cannot announce posting restored before a fresh read", (t) => {
  const h = load(t);
  h.policy.data.activeRestrictions = [];
  h.policy.data.policyNotice = null;
  h.policy.query.isFetchedAfterMount = false;
  assert.doesNotMatch(
    text(h.render()),
    /Không còn hạn chế tạo yêu cầu học|không còn ghi nhận hạn chế|Không có hạn chế đang hiệu lực/,
  );
});

test("unknown outcome or stale read hides acknowledgement and does not announce unlocked posting", (t) => {
  const h = load(t);
  h.policy.needsCheck = true;
  h.policy.error = new AppError("network");
  let tree = h.render();
  assert.match(text(tree), /Chưa xác nhận được kết quả/);
  assert.equal(
    elements(tree).some(
      (el) =>
        el.type === "Button" &&
        text(el.props.children) === "Tôi đã đọc và hiểu chính sách",
    ),
    false,
  );
  assert.doesNotMatch(text(tree), /Kiểm tra lại trạng thái/);
  const retry = elements(tree).find(
    (el) => el.type === "Feedback" && !!el.props.error,
  )!;
  (retry.props.retry as () => void)();
  assert.equal(h.refreshes, 1);
  assert.equal(h.acknowledgements, 0);
  h.policy.data.activeRestrictions = [];
  h.policy.data.policyNotice = null;
  tree = h.render();
  assert.doesNotMatch(text(tree), /Không còn hạn chế tạo yêu cầu học/);
});
