import assert from "node:assert/strict";
import test from "node:test";
import type { ReactNode } from "react";
import { components, load, nodes } from "./fixtures/proposal-ui";
import { proposal } from "./fixtures/proposals-data";
import { fixtureRequest } from "./fixtures/learning-requests-data";

function harness() {
  let confirmation: string | null = null;
  const query = {
    data: fixtureRequest({ id: proposal.learningRequestId! }),
    error: undefined as unknown,
    readDenied: undefined as string | undefined,
    isPending: false,
    isLoading: false,
    isFetching: false,
    refetch: async () => {},
  };
  const reads: unknown[] = [],
    calls: unknown[][] = [];
  const actions = load(
    "../../src/features/proposals/components/ProposalAcceptActions.tsx",
    {
      ...components,
      react: {
        useState: () => [
          confirmation,
          (value: string | null) => {
            confirmation = value;
          },
        ],
      },
      "@/features/learning-requests": {
        useRequestDetail: (id: unknown) => {
          reads.push(id);
          return query;
        },
      },
      "@/features/connections": { ConnectionFeedback: "ConnectionFeedback" },
    },
  ).ProposalAcceptActions!;
  const props = {
    proposal: { ...proposal },
    disabled: false,
    onAccept: async (...args: unknown[]) => {
      calls.push(args);
    },
  };
  return { query, reads, calls, props, render: () => actions(props) };
}
function button(tree: ReactNode, label: string) {
  const node = nodes(tree, "Button").find(
    (entry) => entry.props.children === label,
  );
  assert.ok(node, label);
  return node.props;
}
function click(tree: ReactNode, label: string) {
  (button(tree, label).onPress as () => void)();
}

test("request acceptance displays the current source snapshot and binds both versions", async () => {
  const h = harness();
  const tree = h.render();
  assert.equal(h.reads[0], proposal.learningRequestId);
  assert.ok(
    nodes(tree, "Copy").some(
      (entry) => entry.props.children === h.query.data.description,
    ),
  );
  click(tree, "Chấp nhận đề xuất");
  click(h.render(), "Xác nhận chấp nhận");
  assert.deepEqual(h.calls, [[1, 1]]);
  h.query.data.version++;
  assert.equal(
    nodes(h.render(), "Button").some(
      (node) => node.props.children === "Xác nhận chấp nhận",
    ),
    false,
  );
  click(h.render(), "Chấp nhận đề xuất");
  h.props.proposal.version++;
  assert.equal(
    nodes(h.render(), "Button").some(
      (node) => node.props.children === "Xác nhận chấp nhận",
    ),
    false,
  );
});

test("request load/error/denial or unavailable source cannot accept using a stale cached snapshot", () => {
  for (const patch of [
    { isFetching: true },
    { error: new Error("failed") },
    { readDenied: "forbidden" },
    {
      data: fixtureRequest({
        id: proposal.learningRequestId!,
        status: "NEGOTIATING",
      }),
    },
    {
      data: fixtureRequest({
        id: proposal.learningRequestId!,
        effectiveStatus: "EXPIRED",
      }),
    },
    { data: fixtureRequest() },
  ]) {
    const h = harness();
    Object.assign(h.query, patch);
    const tree = h.render();
    assert.equal(button(tree, "Chấp nhận đề xuất").disabled, true);
    click(tree, "Chấp nhận đề xuất");
    assert.equal(h.calls.length, 0);
    if (h.query.error || h.query.readDenied)
      assert.equal(
        nodes(tree, "Copy").some(
          (entry) => entry.props.children === h.query.data.description,
        ),
        false,
      );
  }
});

test("direct invitation needs no request read and confirms only the proposal version", () => {
  const h = harness();
  h.props.proposal.sourceType = "DIRECT_SEARCH";
  h.props.proposal.learningRequestId = null;
  h.query.error = new Error("unused request query");
  click(h.render(), "Chấp nhận đề xuất");
  click(h.render(), "Xác nhận chấp nhận");
  assert.deepEqual(h.calls, [[1, undefined]]);
  assert.ok(h.reads.every((id) => id === undefined));
  h.props.disabled = true;
  const confirm = button(h.render(), "Xác nhận chấp nhận");
  assert.equal(confirm.disabled, true);
  click(h.render(), "Xác nhận chấp nhận");
  assert.equal(h.calls.length, 1);
});
