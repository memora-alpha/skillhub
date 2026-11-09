import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import { fixtureId } from "./fixtures/learning-requests-data";

type Element = { type: unknown; props: Record<string, unknown> };
function elements(tree: unknown): Element[] {
  if (Array.isArray(tree)) return tree.flatMap(elements);
  if (!tree || typeof tree !== "object" || !("props" in tree)) return [];
  const element = tree as Element;
  return [element, ...elements(element.props.children)];
}

test("cached proposal remains readable after refresh failure but cannot be edited or accepted", async () => {
  for (const edit of [true, false]) {
    const local = createRequire(
      new URL(
        "../src/features/proposals/screens/ApiEditProposalScreen.tsx",
        import.meta.url,
      ),
    );
    const filename = local.resolve(
      edit ? "./ApiEditProposalScreen.tsx" : "./ApiProposalDetailScreen.tsx",
    );
    let runs = 0;
    const routes: unknown[] = [];
    let focus: () => () => void = () => () => {};
    let blur = () => {};
    let complete: (result: unknown) => void = () => {};
    const proposal = {
      id: fixtureId(10),
      proposerId: fixtureId(1),
      recipientId: fixtureId(2),
      sourceType: "DIRECT_SEARCH",
      status: "PENDING",
      version: 1,
    };
    const query = {
      data: proposal,
      error: undefined as unknown,
      isFetching: false,
    };
    const jsx = (type: unknown, props: unknown) => ({ type, props });
    const mocks = {
      "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "Fragment" },
      react: {
        useCallback: (callback: unknown) => callback,
        useRef: (current: unknown) => ({ current }),
        useState: (value: unknown) => [value, () => {}],
      },
      "expo-router": {
        useRouter: () => ({
          replace: (route: unknown) => routes.push(route),
          dismissTo: (route: unknown) => routes.push(route),
        }),
        useFocusEffect: (callback: () => () => void) => {
          focus = callback;
          blur = callback();
        },
        useLocalSearchParams: () => ({}),
      },
      "@/components/feature-page": { Copy: "Copy", RouteButton: "RouteButton" },
      "@/components/learning-flow": { FlowPage: "Page", FlowSection: "Panel" },
      "@/components/Button": { Button: "Button" },
      "@/components/EmptyState": { EmptyState: "EmptyState" },
      "@/components/FormNotice": { FormNotice: "Notice" },
      "@/features/connections": {
        ConnectionFeedback: "Feedback",
        useConnections: () => ({
          userId: fixtureId(edit ? 1 : 2),
          isCurrent: () => true,
        }),
        useConnectionCommand: () => ({
          pending: false,
          uncertain: false,
          run: async () => {
            runs++;
            return new Promise((resolve) => {
              complete = resolve;
            });
          },
        }),
      },
      "../hooks/use-proposals-api": {
        useProposal: () => query,
        useProposalsApi: () => ({}),
      },
      "../components/ApiProposalForm": { ApiProposalForm: "Form" },
      "../components/ProposalRecovery": { ProposalRecovery: "Recovery" },
      "../components/ApiProposalSummary": { ApiProposalSummary: "Summary" },
      "../components/ProposalAcceptActions": {
        ProposalAcceptActions: "Accept",
      },
    };
    const contexts = Object.entries(mocks).map(([name, namedExports]) =>
      mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
    );
    try {
      delete local.cache[filename];
      delete local.cache[local.resolve("../hooks/use-proposal-lifecycle")];
      const screen = local(filename) as {
        ApiEditProposalScreen: (props: { id: string }) => unknown;
        ApiProposalDetailScreen: (props: { id: string }) => unknown;
      };
      const render = () =>
        elements(
          (edit
            ? screen.ApiEditProposalScreen
            : screen.ApiProposalDetailScreen)({ id: proposal.id }),
        );
      const action = () =>
        render().find(
          (element) => element.type === (edit ? "Form" : "Accept"),
        )!;
      assert.equal(action().props.disabled, false);
      query.error = new Error("refresh failed");
      assert.equal(action().props.disabled, true);
      if (edit)
        await (action().props.onSubmit as (hints: unknown) => Promise<void>)({
          message: "draft",
        });
      else
        await (action().props.onAccept as (version: number) => Promise<void>)(
          1,
        );
      assert.equal(
        runs,
        0,
        "a stale callback cannot bypass the read-error guard",
      );
      query.error = undefined;
      assert.equal(action().props.disabled, false);
      const invoke = () => {
        const props = action().props;
        return edit
          ? (props.onSubmit as (hints: unknown) => Promise<void>)({
              message: "draft",
            })
          : (props.onAccept as (version: number) => Promise<void>)(1);
      };
      for (const refocus of [false, true]) {
        const pending = invoke();
        blur();
        if (refocus) blur = focus();
        complete({ id: proposal.id, conversation: { id: fixtureId(20) } });
        await pending;
        assert.equal(
          routes.length,
          0,
          "late decisions cannot navigate after leaving, even after returning",
        );
      }
      const pending = invoke();
      complete({ id: proposal.id, conversation: { id: fixtureId(20) } });
      await pending;
      assert.equal(
        routes.length,
        1,
        "the current visit still navigates on success",
      );
    } finally {
      delete local.cache[filename];
      delete local.cache[local.resolve("../hooks/use-proposal-lifecycle")];
      for (const context of contexts.reverse()) context.restore();
    }
  }
});
