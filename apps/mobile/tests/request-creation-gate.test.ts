import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import {
  canCreateRequest,
  hasRequestRestriction,
} from "../src/features/community/utils/reputation-policy";
import { AppError } from "../src/lib/http/errors";
import type { Reputation } from "../src/features/community/api/community-api";

const snapshot = (): Reputation => ({
  reputationScore: 25,
  level: "LOW",
  activeRestrictions: [],
  policyNotice: null,
  items: [],
  nextCursor: null,
});
function policyFixture() {
  return {
    data: snapshot(),
    pending: false,
    acknowledged: false,
    needsCheck: false,
    error: undefined as unknown,
    query: {
      isFetchedAfterMount: true,
      isFetching: false,
      isLoading: false,
      denied: undefined as unknown,
      error: undefined as unknown,
    },
    refresh: async () => {},
    acknowledge: async () => {},
  };
}

test("creation eligibility uses fresh server restrictions, including ALL, without inventing a reputation threshold", () => {
  const policy = policyFixture();
  assert.equal(
    canCreateRequest(policy),
    true,
    "low score alone does not establish an active restriction",
  );
  for (const scope of [
    "ALL",
    "CREATE_NEW_ACTIVITY",
    "learning-request:create",
  ]) {
    policy.data.activeRestrictions = [
      { scope, reasonCode: "LOW_REPUTATION", endsAt: "2026-01-01T00:00:00Z" },
    ];
    assert.equal(
      canCreateRequest(policy),
      false,
      "a past date does not override the server's effective restriction",
    );
  }
  policy.data.activeRestrictions = [];
  policy.query.isFetchedAfterMount = false;
  assert.equal(canCreateRequest(policy), false);
  policy.query.isFetchedAfterMount = true;
  policy.query.error = new AppError("network");
  assert.equal(canCreateRequest(policy), false);
  policy.query.error = undefined;
  policy.needsCheck = true;
  assert.equal(canCreateRequest(policy), false);
});

test("new request gate withholds the composer until checked, then preserves the mounted draft on later denial", () => {
  const local = createRequire(
    new URL(
      "../src/features/learning-requests/components/request-creation-gate.tsx",
      import.meta.url,
    ),
  );
  const filename = local.resolve("./request-creation-gate.tsx");
  const policy = policyFixture();
  let admitted = false,
    renders = 0;
  const draft = { title: "Nội dung người dùng đã nhập" };
  const jsx = (type: unknown, props: unknown) => ({ type, props });
  const contexts = Object.entries({
    "react/jsx-runtime": { jsx, jsxs: jsx },
    react: {
      useState: () => [
        admitted,
        (value: boolean) => {
          admitted = value;
        },
      ],
      useEffect: (effect: () => void) => effect(),
    },
    "react-native": { Text: "Text", View: "View" },
    "@/features/community/policy": {
      useReputationPolicy: () => policy,
      canCreateRequest,
      hasRequestRestriction,
      ReputationSummary: "Summary",
      ReputationPolicyContent: "PolicyContent",
    },
    "@/features/connections": { ConnectionFeedback: "Feedback" },
    "@/components/FormNotice": { FormNotice: "Notice" },
    "./request-page": { RequestPage: "Page" },
  }).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  try {
    delete local.cache[filename];
    const { RequestCreationGate } = local(
      filename,
    ) as typeof import("../src/features/learning-requests/components/request-creation-gate");
    const render = () =>
      RequestCreationGate({
        children: (value) => {
          renders++;
          return jsx("Composer", {
            draft,
            disabled: !canCreateRequest(value),
          }) as never;
        },
      }) as unknown as { type: unknown; props: Record<string, unknown> };
    policy.query.isFetchedAfterMount = false;
    assert.equal(render().type, "Page");
    assert.equal(renders, 0);
    policy.query.isFetchedAfterMount = true;
    policy.data.activeRestrictions = [
      {
        scope: "CREATE_NEW_ACTIVITY",
        reasonCode: "LOW_REPUTATION",
        endsAt: "2026-01-01T00:00:00Z",
      },
    ];
    assert.equal(render().type, "Page");
    assert.equal(renders, 0);
    policy.query.error = new AppError("http", 403);
    assert.equal(render().type, "Page");
    assert.equal(renders, 0);
    policy.query.error = undefined;
    policy.data.activeRestrictions = [];
    const composer = render();
    assert.equal(composer.type, "Composer");
    assert.equal(composer.props.disabled, false);
    policy.data.activeRestrictions = [
      {
        scope: "CREATE_NEW_ACTIVITY",
        reasonCode: "LOW_REPUTATION",
        endsAt: "2026-01-01T00:00:00Z",
      },
    ];
    const blocked = render();
    assert.equal(blocked.type, "Composer");
    assert.equal(blocked.props.disabled, true);
    assert.equal(blocked.props.draft, draft);
  } finally {
    delete local.cache[filename];
    contexts.reverse().forEach((context) => context.restore());
  }
});
