import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test, type TestContext } from "node:test";
import { pathToFileURL } from "node:url";
import type { Reputation } from "../src/features/community/api/community-api";
import { canCreateRequest } from "../src/features/community/utils/reputation-policy";
import { AppError } from "../src/lib/http/errors";
import { fixtureRequest } from "./fixtures/learning-requests-data";

type Element = { type: unknown; props: Record<string, unknown> };
function elements(tree: unknown): Element[] {
  if (Array.isArray(tree)) return tree.flatMap(elements);
  if (!tree || typeof tree !== "object" || !("props" in tree)) return [];
  const el = tree as Element;
  if (typeof el.type === "function") return elements(el.type(el.props));
  return [el, ...elements(el.props.children)];
}

function load(t: TestContext) {
  const local = createRequire(
    new URL(
      "../src/features/learning-requests/components/request-detail-actions.tsx",
      import.meta.url,
    ),
  );
  const files = [
    local.resolve("./request-detail-actions.tsx"),
    local.resolve("./request-publish-policy.tsx"),
  ];
  const policy = {
    data: {
      reputationScore: 25,
      level: "LOW",
      activeRestrictions: [],
      policyNotice: null,
      items: [],
      nextCursor: null,
    } as Reputation,
    pending: false,
    acknowledged: false,
    needsCheck: false,
    error: undefined as unknown,
    query: {
      isFetchedAfterMount: true,
      isFetching: false,
      denied: undefined as unknown,
      error: undefined as unknown,
    },
    refresh: async () => {
      reads++;
    },
  };
  const commands: string[] = [],
    routes: unknown[] = [],
    enabled: boolean[] = [];
  let reads = 0;
  const jsx = (type: unknown, props: unknown) => ({ type, props });
  const contexts = Object.entries({
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "react-native": {
      Text: "Text",
      View: "View",
      StyleSheet: { create: (value: unknown) => value },
    },
    "expo-router": {
      useRouter: () => ({ push: (route: unknown) => routes.push(route) }),
    },
    "@/components/Button": { Button: "Button" },
    "@/components/FormNotice": { FormNotice: "Notice" },
    "@/components/Icon": { Icon: "Icon" },
    "@/components/feature-page": { Copy: "Copy" },
    "@/features/connections": { ConnectionFeedback: "Feedback" },
    "@/features/community/policy": {
      useReputationPolicy: (value: boolean) => {
        enabled.push(value);
        return policy;
      },
      canCreateRequest,
    },
    "./request-restriction-notice": { RequestRestrictionNotice: "Restriction" },
    "./request-section": { RequestSection: "Section" },
  }).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  files.forEach((file) => {
    delete local.cache[file];
  });
  const { RequestOwnerFooter } = local(
    files[0]!,
  ) as typeof import("../src/features/learning-requests/components/request-detail-actions");
  t.after(() => {
    files.forEach((file) => {
      delete local.cache[file];
    });
    contexts.reverse().forEach((context) => context.restore());
  });
  return {
    policy,
    commands,
    routes,
    enabled,
    get reads() {
      return reads;
    },
    render(
      status: "DRAFT" | "OPEN" = "DRAFT",
      blocked = false,
      pending = false,
    ) {
      return elements(
        RequestOwnerFooter({
          request: fixtureRequest({
            status,
            publishedAt: status === "DRAFT" ? null : new Date().toISOString(),
          }),
          pending,
          blocked,
          run: async (command) => {
            commands.push(command);
          },
          refresh: () => {},
        }),
      );
    },
  };
}
const button = (nodes: Element[], label: string) =>
  nodes.find(
    (el) => el.type === "Button" && el.props.accessibilityLabel === label,
  )!;

test("saved draft publishing waits for fresh reputation; stale cache, read errors and restrictions never disable editing", async (t) => {
  const h = load(t);
  for (const phase of [
    "cached",
    "fetching",
    "failed",
    "denied",
    "restricted",
  ] as const) {
    h.policy.query.isFetchedAfterMount = phase !== "cached";
    h.policy.query.isFetching = phase === "fetching";
    h.policy.query.error =
      phase === "failed" ? new AppError("network") : undefined;
    h.policy.query.denied = phase === "denied" ? "forbidden" : undefined;
    h.policy.data.activeRestrictions =
      phase === "restricted"
        ? [
            {
              scope: "CREATE_NEW_ACTIVITY",
              reasonCode: "LOW_REPUTATION",
              endsAt: "2026-01-01T00:00:00Z",
            },
          ]
        : [];
    const nodes = h.render();
    const publish = button(nodes, "Đăng yêu cầu học");
    assert.equal(publish.props.disabled, true, phase);
    (publish.props.onPress as () => void)();
    const edit = button(nodes, "Chỉnh sửa yêu cầu");
    assert.equal(edit.props.disabled, false, phase);
    if (phase === "restricted") {
      assert.ok(
        nodes.some(
          (el) =>
            el.type === "Notice" &&
            String(el.props.children).includes("bị hạn chế đăng yêu cầu học"),
        ),
      );
      (edit.props.onPress as () => void)();
      const link = nodes.find(
        (el) =>
          el.type === "Button" && el.props.children === "Xem uy tín và hạn chế",
      )!;
      (link.props.onPress as () => void)();
      assert.deepEqual(h.routes, ["/reputation"]);
    }
    if (phase === "failed") {
      const feedback = nodes.find((el) => el.type === "Feedback")!;
      await (feedback.props.retry as () => Promise<void>)();
      assert.equal(h.reads, 1);
    }
  }
  assert.deepEqual(h.commands, ["edit"]);
});

test("fresh unrestricted low-score draft allows only explicit publish and retains other pending/conflict locks", (t) => {
  const h = load(t);
  let nodes = h.render();
  assert.equal(button(nodes, "Đăng yêu cầu học").props.disabled, false);
  assert.deepEqual(h.commands, []);
  assert.equal(
    nodes.some((el) => el.type === "Notice"),
    false,
  );
  (button(nodes, "Đăng yêu cầu học").props.onPress as () => void)();
  assert.deepEqual(h.commands, ["publish"]);
  for (const [blocked, pending] of [
    [true, false],
    [false, true],
  ]) {
    nodes = h.render("DRAFT", blocked, pending);
    assert.equal(button(nodes, "Đăng yêu cầu học").props.disabled, true);
    (button(nodes, "Đăng yêu cầu học").props.onPress as () => void)();
  }
  assert.deepEqual(h.commands, ["publish"]);
  nodes = h.render("OPEN");
  assert.equal(h.enabled.at(-1), false);
  assert.equal(
    nodes.some((el) => el.props.accessibilityLabel === "Đăng yêu cầu học"),
    false,
  );
  assert.equal(button(nodes, "Chỉnh sửa yêu cầu").props.disabled, false);
});
