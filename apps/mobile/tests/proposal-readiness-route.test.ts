import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import { fixtureId } from "./fixtures/learning-requests-data";

type Element = { type: unknown; props: Record<string, unknown> };
function elements(tree: unknown): Element[] {
  if (Array.isArray(tree)) return tree.flatMap(elements);
  if (!tree || typeof tree !== "object" || !("props" in tree)) return [];
  const el = tree as Element;
  return [el, ...elements(el.props.children)];
}

test("duplicate proposal action opens an existing detail route with the duplicate ID", () => {
  const local = createRequire(
    new URL(
      "../src/features/proposals/components/proposal-readiness.tsx",
      import.meta.url,
    ),
  );
  const filename = local.resolve("./proposal-readiness.tsx");
  let route: { pathname: string; params: { id: string } } | undefined;
  const jsx = (type: unknown, props: unknown) => ({ type, props });
  const contexts = Object.entries({
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "react-native": { Text: "Text", View: "View" },
    "expo-router": {
      useRouter: () => ({
        push: (target: typeof route) => {
          route = target;
        },
      }),
    },
    "@/components/Button": { Button: "Button" },
    "@/components/Icon": { Icon: "Icon" },
    "@/features/connections": { ConnectionFeedback: "Feedback" },
  }).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  try {
    delete local.cache[filename];
    const { ProposalReadiness } = local(
      filename,
    ) as typeof import("../src/features/proposals/components/proposal-readiness");
    const duplicate = { id: fixtureId(9) };
    const render = (checking = false, error: unknown = null) =>
      elements(
        ProposalReadiness({
          skill: "React",
          duplicate,
          checking,
          error,
          retry() {},
        }),
      ).filter((el) => el.type === "Button");
    assert.equal(render(true).length, 0);
    assert.equal(render(false, Error("offline")).length, 0);
    const [button] = render();
    (button!.props.onPress as () => void)();
    assert.ok(route);
    assert.equal(route.params.id, duplicate.id);
    assert.ok(
      existsSync(
        new URL(`../src/app${route.pathname}/index.tsx`, import.meta.url),
      ),
      `Missing route: ${route.pathname}`,
    );
  } finally {
    delete local.cache[filename];
    contexts.reverse().forEach((context) => context.restore());
  }
});
