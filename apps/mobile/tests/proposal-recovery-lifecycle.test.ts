import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";

type Element = { type: unknown; props: Record<string, unknown> };
function elements(tree: unknown): Element[] {
  if (Array.isArray(tree)) return tree.flatMap(elements);
  if (!tree || typeof tree !== "object" || !("props" in tree)) return [];
  const element = tree as Element;
  return [element, ...elements(element.props.children)];
}

test("proposal recovery belongs to the visit that started the retry", async () => {
  const local = createRequire(
    new URL(
      "../src/features/proposals/components/ProposalRecovery.tsx",
      import.meta.url,
    ),
  );
  const jsx = (type: unknown, props: unknown) => ({ type, props });
  const mocks = {
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "Fragment" },
    "@/components/learning-flow": { FlowSection: "Panel" },
    "@/components/EmptyState": { EmptyState: "Empty" },
    "@/components/FormNotice": { FormNotice: "Notice" },
    "@/components/Button": { Button: "Button" },
    "@/features/connections": { ConnectionFeedback: "Feedback" },
    "./ApiProposalForm": { ApiProposalForm: "Form" },
    "./proposal-send-layout": { ProposalSendContext: "Context" },
    "./proposal-readiness": { ProposalReadiness: "Readiness" },
  };
  const contexts = Object.entries(mocks).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  const files = ["./ProposalRecovery", "./proposal-send-content"].map((name) =>
    local.resolve(name),
  );
  try {
    files.forEach((file) => {
      delete local.cache[file];
    });
    const { ProposalRecovery } = local(files[0]!);
    const { ProposalRecoveryPanel } = local(files[1]!);
    for (const panel of [false, true]) {
      let visit = 1,
        navigated = 0;
      let complete: (value: unknown) => void = () => {};
      const retry = () =>
        new Promise((resolve) => {
          complete = resolve;
        });
      const captureCurrent = () => {
        const started = visit;
        return () => visit === started;
      };
      const open = () => {
        navigated++;
      };
      const tree = panel
        ? ProposalRecoveryPanel({
            uncertain: true,
            pending: false,
            isCurrent: () => true,
            captureCurrent,
            retry,
            openResult: open,
          })
        : ProposalRecovery({
            command: { uncertain: true, pending: false, retry },
            captureCurrent,
            onRecovered: open,
          });
      const button = elements(tree).find(
        (element) => element.type === "Button",
      )!;
      (button.props.onPress as () => void)();
      visit++;
      complete({ id: "confirmed" });
      await new Promise((resolve) => setImmediate(resolve));
      assert.equal(navigated, 0);
      (button.props.onPress as () => void)();
      complete({ id: "confirmed" });
      await new Promise((resolve) => setImmediate(resolve));
      assert.equal(
        navigated,
        1,
        "an explicit retry on the current visit can navigate",
      );
    }
  } finally {
    files.forEach((file) => {
      delete local.cache[file];
    });
    for (const context of contexts.reverse()) context.restore();
  }
});
