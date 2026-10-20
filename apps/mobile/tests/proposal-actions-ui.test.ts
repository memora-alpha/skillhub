import assert from "node:assert/strict";
import test from "node:test";
import * as React from "react";
import { components, load, nodes } from "./fixtures/proposal-ui";
import {
  conversation,
  proposal,
  proposerId,
  recipientId,
} from "./fixtures/proposals-data";
import { proposalStatusLabels } from "../src/features/proposals/constants/proposal-status";

function harness() {
  const query = {
    data: { ...proposal },
    isFetching: false,
    isLoading: false,
    isPending: false,
  };
  const routes: unknown[] = [],
    calls: unknown[][] = [];
  let userId = recipientId,
    confirmationVersion: number | null = null;
  const command = {
    pending: false,
    uncertain: false,
    run: async (
      _fingerprint: string,
      send: (key: string) => Promise<unknown>,
    ) => send("intent-key"),
  };
  const mocks = {
    ...components,
    react: {
      useState: () => [
        confirmationVersion,
        (value: number | null) => {
          confirmationVersion = value;
        },
      ],
      useRef: () => ({ current: undefined }),
    },
    "expo-router": {
      useRouter: () => ({
        replace: (route: unknown) => routes.push(route),
        dismissTo: (route: unknown) => routes.push(route),
        back() {},
      }),
    },
    "@/features/connections": {
      useConnections: () => ({ userId, isCurrent: () => true }),
      useConnectionCommand: () => command,
      ConnectionFeedback: "ConnectionFeedback",
    },
    "../hooks/use-proposals-api": {
      useProposal: () => query,
      useProposalsApi: () => ({
        decide: async (...args: unknown[]) => {
          calls.push(args);
          return { proposal, conversation };
        },
      }),
    },
    "../components/ApiProposalSummary": {
      ApiProposalSummary: "ApiProposalSummary",
    },
    "../components/ApiProposalForm": { ApiProposalForm: "ApiProposalForm" },
    "../components/ProposalRecovery": { ProposalRecovery: "ProposalRecovery" },
    "../components/ProposalAcceptActions": {
      ProposalAcceptActions: "ProposalAcceptActions",
    },
  };
  return {
    query,
    routes,
    calls,
    command,
    mocks,
    setUser: (id: string) => {
      userId = id;
    },
  };
}
const click = (tree: React.ReactNode, label: string) => {
  const button = nodes(tree, "Button").find(
    (node) => node.props.children === label,
  );
  assert.ok(button, `missing ${label}`);
  (button.props.onPress as () => void)();
};
const tick = () => new Promise<void>((resolve) => setImmediate(resolve));
const plain = (value: unknown) => JSON.parse(JSON.stringify(value));

test("accept sends both displayed versions and opens the returned conversation ID", async () => {
  const h = harness();
  const detail = load(
    "../../src/features/proposals/screens/ApiProposalDetailScreen.tsx",
    h.mocks,
  ).ApiProposalDetailScreen!;
  const render = () => detail({ id: proposal.id });
  const onAccept = () =>
    nodes(render(), "ProposalAcceptActions")[0]!.props.onAccept as (
      version: number,
      requestVersion?: number,
    ) => Promise<void>;
  const previous = onAccept();
  h.query.data.version = 2;
  await onAccept()(1, 7);
  assert.equal(h.calls.length, 0);
  assert.ok(previous);
  await onAccept()(2, 7);
  await tick();
  assert.deepEqual(h.calls, [[proposal.id, "accept", 2, "intent-key", 7]]);
  assert.deepEqual(plain(h.routes[0]), {
    pathname: "/chat/[proposalId]",
    params: { proposalId: conversation.id, mode: "api" },
  });
  h.command.uncertain = true;
  assert.equal(nodes(render(), "Button").length, 0);
  assert.equal(nodes(render(), "RouteButton").length, 0);
  assert.equal(nodes(render(), "ProposalRecovery").length, 1);
});

test("detail actions follow pending status and sender/recipient roles", () => {
  const h = harness();
  const detail = load(
    "../../src/features/proposals/screens/ApiProposalDetailScreen.tsx",
    h.mocks,
  ).ApiProposalDetailScreen!;
  const render = () => detail({ id: proposal.id });
  assert.deepEqual(
    nodes(render(), "RouteButton").map((node) => node.props.children),
    ["Từ chối đề xuất"],
  );
  h.setUser(proposerId);
  assert.equal(nodes(render(), "Button").length, 0);
  assert.deepEqual(
    nodes(render(), "RouteButton").map((node) => node.props.children),
    ["Chỉnh sửa đề xuất", "Rút đề xuất"],
  );
  h.query.data.status = "REJECTED";
  assert.equal(nodes(render(), "RouteButton").length, 0);
});

for (const action of ["reject", "withdraw"] as const) {
  test(`${action}: no reason field, correct actor/version, uncertain command cannot resubmit`, async () => {
    const h = harness();
    const close = load(
      "../../src/features/proposals/screens/ApiCloseProposalScreen.tsx",
      h.mocks,
    ).ApiCloseProposalScreen!;
    if (action === "withdraw") h.setUser(proposerId);
    const render = () => close({ id: proposal.id, action });
    assert.equal(nodes(render(), "ControlledInput").length, 0);
    click(
      render(),
      action === "reject" ? "Xác nhận từ chối" : "Xác nhận rút đề xuất",
    );
    await tick();
    assert.deepEqual(h.calls, [
      [proposal.id, action, proposal.version, "intent-key"],
    ]);
    h.command.uncertain = true;
    const blocked = render();
    assert.equal(nodes(blocked, "Button")[0]!.props.disabled, true);
    click(
      blocked,
      action === "reject" ? "Xác nhận từ chối" : "Xác nhận rút đề xuất",
    );
    await tick();
    assert.equal(h.calls.length, 1);
    h.setUser(action === "withdraw" ? recipientId : proposerId);
    assert.equal(nodes(render(), "Button").length, 0);
    assert.equal(nodes(render(), "ProposalRecovery").length, 1);
  });
}

test("edit preserves recovery access when the proposal becomes read-only", () => {
  const h = harness();
  h.setUser(proposerId);
  const edit = load(
    "../../src/features/proposals/screens/ApiEditProposalScreen.tsx",
    h.mocks,
  ).ApiEditProposalScreen!;
  assert.equal(
    nodes(edit({ id: proposal.id }), "FeaturePage")[0]!.props
      .keyboardDismissMode,
    "none",
  );
  h.command.uncertain = true;
  assert.equal(
    nodes(edit({ id: proposal.id }), "ApiProposalForm")[0]!.props.locked,
    true,
  );
  h.query.data.status = "WITHDRAWN";
  const tree = edit({ id: proposal.id });
  assert.equal(nodes(tree, "ApiProposalForm").length, 0);
  assert.equal(nodes(tree, "ProposalRecovery").length, 1);
});

test("summary renders real hints only when present, and no local metadata", () => {
  const summary = load(
    "../../src/features/proposals/components/ApiProposalSummary.tsx",
    {
      ...components,
      "expo-router": { useRouter: () => ({ push() {} }) },
      "@/components/Badge": { Badge: "Badge" },
      "@/features/connections": {
        useConnections: () => ({ userId: proposerId }),
        useParticipantName: () => ({ data: "Người học" }),
        useCatalogName: () => ({ data: "TypeScript" }),
      },
      "../constants/proposal-status": { proposalStatusLabels },
    },
  ).ApiProposalSummary!;
  const text = (tree: React.ReactNode) =>
    JSON.stringify(nodes(tree, "Copy").map((node) => node.props.children));
  const empty = text(summary({ proposal }));
  assert.doesNotMatch(
    empty,
    /Chưa đề xuất|Credit gợi ý|Số buổi|Thời lượng|Hình thức|localDecisionNote/,
  );
  const populated = text(
    summary({
      proposal: {
        ...proposal,
        proposedCredit: "20.00",
        initialSessionCount: 2,
      },
    }),
  );
  assert.match(populated, /Credit gợi ý/);
  assert.match(populated, /20.00/);
  assert.match(populated, /Số buổi/);
});

test("recovery repeats the saved command and ignores an unresolved retry", async () => {
  const recovery = load(
    "../../src/features/proposals/components/ProposalRecovery.tsx",
    {
      ...components,
      "@/features/connections": { ConnectionFeedback: "ConnectionFeedback" },
    },
  ).ProposalRecovery!;
  const first = new Error("network"),
    latest = new Error("server");
  const recovered: unknown[] = [];
  const retryState = { result: undefined as unknown };
  const command = {
    uncertain: true,
    pending: false,
    originalError: first,
    error: latest,
    retry: async () => retryState.result,
  };
  const render = () =>
    recovery({
      command,
      onRecovered: (value: unknown) => recovered.push(value),
    });
  assert.equal(nodes(render(), "ConnectionFeedback").length, 2);
  click(render(), "Kiểm tra lại thao tác trước");
  await tick();
  assert.equal(recovered.length, 0);
  retryState.result = { proposal };
  click(render(), "Kiểm tra lại thao tác trước");
  await tick();
  assert.deepEqual(recovered, [retryState.result]);
  command.pending = true;
  assert.equal(nodes(render(), "Button")[0]!.props.disabled, true);
  command.uncertain = false;
  assert.equal(render(), null);
});
