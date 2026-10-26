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
        useRef: (current: unknown) => ({ current }),
        useState: (value: unknown) => [value, () => {}],
      },
      "expo-router": {
        useRouter: () => ({}),
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
            return undefined;
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
    } finally {
      delete local.cache[filename];
      for (const context of contexts.reverse()) context.restore();
    }
  }
});
