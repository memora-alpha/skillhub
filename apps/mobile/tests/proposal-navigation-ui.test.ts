import assert from "node:assert/strict";
import test from "node:test";
import type { ReactElement, ReactNode } from "react";
import { components, load, nodes, type Props } from "./fixtures/proposal-ui";
import { appColors, fonts, typography } from "../src/constants/theme";
import { proposalStatusLabels } from "../src/features/proposals/constants/proposal-status";
import { proposal } from "./fixtures/proposals-data";
import { searchProposals } from "../src/features/proposals/utils/search-proposals";
import {
  proposalId,
  proposalListFilter,
  proposalSource,
} from "../src/features/proposals/utils/proposal-route";

for (const [screen, apiScreen, validParams] of [
  [
    "SendProposalScreen",
    "ApiSendProposalScreen",
    { requestId: proposal.learningRequestId },
  ],
  ["ProposalDetailScreen", "ApiProposalDetailScreen", { id: proposal.id }],
  ["EditProposalScreen", "ApiEditProposalScreen", { id: proposal.id }],
  [
    "CloseProposalScreen",
    "ApiCloseProposalScreen",
    { id: proposal.id, action: "reject" },
  ],
] as const) {
  test(`${screen} refuses sample IDs and missing source instead of using local fixtures`, () => {
    let params: unknown = validParams;
    const component = load(
      `../../src/features/proposals/screens/${screen}.tsx`,
      {
        "expo-router": { useLocalSearchParams: () => params },
        [`./${apiScreen}`]: { [apiScreen]: apiScreen },
        "../components/ProposalUnavailable": {
          ProposalUnavailable: "ProposalUnavailable",
        },
        "../utils/proposal-route": { proposalId, proposalSource },
      },
    )[screen]!;
    assert.equal(nodes(component({}), apiScreen).length, 1);
    for (const invalid of [
      {},
      { id: "DX-001", requestId: "preview-request-1" },
      { id: [proposal.id] },
    ]) {
      params = invalid;
      assert.equal(nodes(component({}), apiScreen).length, 0);
      assert.equal(nodes(component({}), "ProposalUnavailable").length, 1);
    }
    if (screen === "CloseProposalScreen") {
      params = { id: proposal.id, action: "cancel" };
      assert.equal(nodes(component({}), "ProposalUnavailable").length, 1);
    }
  });
}

test("request scope is preserved for statuses; view all clears it and includes both directions", () => {
  let params: unknown = {
    tab: "received",
    status: "PENDING",
    learningRequestId: proposal.learningRequestId,
  };
  const reads: unknown[][] = [],
    changes: unknown[] = [];
  const state: unknown[] = [false, ""];
  let stateIndex = 0;
  const screen = load(
    "../../src/features/proposals/screens/ApiProposalsScreen.tsx",
    {
      ...components,
      react: {
        useState: () => {
          const index = stateIndex++;
          return [
            state[index],
            (value: unknown) => {
              state[index] = value;
            },
          ];
        },
      },
      "expo-router": {
        useLocalSearchParams: () => params,
        useRouter: () => ({
          setParams: (value: unknown) => changes.push(value),
        }),
      },
      "react-native": {
        FlatList: "FlatList",
        ScrollView: "ScrollView",
        View: "View",
      },
      "@/features/shell": { AppScreenLayout: "AppScreenLayout" },
      "../components/ProposalListFilters": {
        ProposalListFilters: "ProposalListFilters",
      },
      "../components/ProposalSearch": {
        ProposalSearchButton: "ProposalSearchButton",
        ProposalSearchField: "ProposalSearchField",
      },
      "../utils/search-proposals": { searchProposals },
      "@/features/connections": { ConnectionFeedback: "ConnectionFeedback" },
      "../hooks/use-proposals-api": {
        useProposalList: (...args: unknown[]) => {
          reads.push(args);
          return { items: [proposal] };
        },
      },
      "../components/ApiProposalSummary": {
        ApiProposalSummary: "ApiProposalSummary",
      },
      "../utils/proposal-route": { proposalListFilter },
      "../components/ProposalUnavailable": {
        ProposalUnavailable: "ProposalUnavailable",
      },
    },
  ).ApiProposalsScreen!;
  const tree = screen({}) as ReactElement<Props>;
  assert.deepEqual(reads[0], [
    "received",
    "PENDING",
    proposal.learningRequestId,
    true,
  ]);
  const list = (tree.props.children as unknown as () => ReactElement<Props>)();
  const header = list.props.ListHeaderComponent as ReactNode;
  const filters = nodes(header, "ProposalListFilters")[0]!.props;
  assert.equal(filters.value, "PENDING");
  const changeTab = filters.onChange as (value: string) => void;
  changeTab("all");
  assert.deepEqual(
    { ...(changes[0] as object) },
    { tab: "all", status: undefined, learningRequestId: undefined },
  );
  changeTab("ACCEPTED");
  changeTab("all");
  assert.deepEqual(
    { ...(changes[1] as object) },
    {
      tab: "received",
      status: "ACCEPTED",
      learningRequestId: proposal.learningRequestId,
    },
  );
  assert.deepEqual(
    { ...(changes[2] as object) },
    {
      tab: "all",
      status: undefined,
      learningRequestId: undefined,
    },
  );
  params = { tab: "sent", status: "ACCEPTED" };
  stateIndex = 0;
  const sentTree = screen({}) as ReactElement<Props>;
  assert.deepEqual(reads[1], ["sent", "ACCEPTED", undefined, true]);
  const sentList = (
    sentTree.props.children as unknown as () => ReactElement<Props>
  )();
  const sentFilters = nodes(
    sentList.props.ListHeaderComponent as ReactNode,
    "ProposalListFilters",
  )[0]!.props;
  assert.equal(sentFilters.value, "ACCEPTED");
  (sentFilters.onChange as (value: string) => void)("REJECTED");
  assert.deepEqual(
    { ...(changes[3] as object) },
    {
      tab: "all",
      status: "REJECTED",
      learningRequestId: undefined,
    },
  );
  params = { tab: "sent", learningRequestId: proposal.learningRequestId };
  stateIndex = 0;
  assert.equal(nodes(screen({}), "ProposalUnavailable").length, 1);
  assert.equal(reads[2]![3], false);
  params = {};
  const render = () => {
    stateIndex = 0;
    const current = screen({}) as ReactElement<Props>;
    const currentList = (
      current.props.children as unknown as () => ReactElement<Props>
    )();
    return {
      current,
      currentList,
      header: currentList.props.ListHeaderComponent as ReactNode,
    };
  };
  const closed = render();
  assert.equal(nodes(closed.header, "ProposalSearchField").length, 0);
  const button = nodes(
    closed.current.props.rightAction as ReactNode,
    "ProposalSearchButton",
  )[0]!.props;
  (button.onPress as () => void)();
  const open = render();
  const field = nodes(open.header, "ProposalSearchField")[0]!.props;
  (field.onChange as (value: string) => void)("không có nội dung này");
  const empty = render();
  assert.deepEqual(empty.currentList.props.data, []);
  const emptyState = empty.currentList.props
    .ListEmptyComponent as ReactElement<Props>;
  assert.equal(emptyState.props.action, "Xóa tìm kiếm");
  (emptyState.props.onAction as () => void)();
  assert.deepEqual(render().currentList.props.data, [proposal]);
  (field.onChange as (value: string) => void)("huong dan");
  assert.deepEqual(render().currentList.props.data, [proposal]);
  const closeButton = nodes(
    render().current.props.rightAction as ReactNode,
    "ProposalSearchButton",
  )[0]!.props;
  (closeButton.onPress as () => void)();
  assert.equal(nodes(render().header, "ProposalSearchField").length, 0);
  assert.equal(state[1], "");
  (field.onChange as (value: string) => void)("từ khóa đang lọc");
  (
    nodes(render().header, "ProposalListFilters")[0]!.props.onChange as (
      value: string,
    ) => void
  )("all");
  assert.equal(state[1], "");
  assert.equal(state[0], false);
  assert.deepEqual(
    { ...(changes.at(-1) as object) },
    {
      tab: "all",
      status: undefined,
      learningRequestId: undefined,
    },
  );
});

test("proposal filters show five BE states and one full-list tab without mixing direction", () => {
  const changed: unknown[] = [];
  const controls = load(
    "../../src/features/proposals/components/ProposalListFilters.tsx",
    {
      "react-native": {
        Pressable: "Pressable",
        ScrollView: "ScrollView",
        Text: "Text",
        View: "View",
        StyleSheet: { create: (value: unknown) => value },
      },
      "@/constants/theme": { appColors, fonts, typography },
      "../constants/proposal-status": { proposalStatusLabels },
    },
  );
  const filters = controls.ProposalListFilters!;
  const values = [
    "all",
    "PENDING",
    "ACCEPTED",
    "REJECTED",
    "WITHDRAWN",
    "EXPIRED",
  ];
  for (const value of values) {
    const tree = filters({
      value,
      onChange: (next: unknown) => changed.push(next),
    });
    const rows = nodes(tree, "ScrollView");
    assert.equal(rows.length, 1);
    assert.equal(rows[0]!.props.horizontal, true);
    const tabs = nodes(rows[0]!, "Pressable");
    assert.equal(tabs.length, 6);
    assert.equal(nodes(tabs[0]!, "Text")[0]!.props.children, "Xem tất cả");
    const selected = tabs.filter(
      (tab) => (tab.props.accessibilityState as { selected: boolean }).selected,
    );
    assert.equal(selected.length, 1);
    assert.equal(selected[0]!.props["aria-selected"], true);
    (selected[0]!.props.onPress as () => void)();
    assert.equal(changed.at(-1), value);
    assert.equal(nodes(tree, "Pressable").length, 6);
  }
});
