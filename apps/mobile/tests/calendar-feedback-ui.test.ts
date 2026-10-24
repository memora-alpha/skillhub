import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import { AppError } from "../src/lib/http/errors";

type Element = { type: unknown; props: Record<string, unknown> };
function nodes(tree: unknown): Element[] {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== "object" || !("props" in tree)) return [];
  const element = tree as Element;
  return [element, ...nodes(element.props.children)];
}
test("Calendar429 preserves deadline and cached content through shared cooldown feedback; denial hides content", () => {
  const local = createRequire(
    new URL(
      "../src/features/sessions/components/session-feedback.tsx",
      import.meta.url,
    ),
  );
  const filename = local.resolve("./session-feedback.tsx");
  const jsx = (type: unknown, props: unknown) => ({ type, props });
  const mocks = {
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "Fragment" },
    "react-native": { ActivityIndicator: "Loading" },
    "@/components/LoadingIndicator": { LoadingIndicator: "Loading" },
    "./session-page": { SessionButton: "Button", SessionEmptyState: "Empty" },
    "@/components/FormNotice": { FormNotice: "Notice" },
    "@/features/connections": { ConnectionFeedback: "Cooldown" },
  };
  const contexts = Object.entries(mocks).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  try {
    delete local.cache[filename];
    const { SessionFeedback } = local(
      filename,
    ) as typeof import("../src/features/sessions/components/session-feedback");
    const limited = new AppError(
      "http",
      429,
      "RATE_LIMITED",
      Date.now() + 60000,
    );
    const props = {
      data: undefined as unknown,
      enabled: true,
      error: limited,
      refreshing: false,
      retry() {},
      children: "Cached session",
    };
    const initial = nodes(SessionFeedback(props));
    assert.equal(initial[0]?.type, "Cooldown");
    assert.equal(initial[0]?.props.error, limited);
    assert.equal(
      initial.some((node) => node.type === "Button"),
      false,
    );
    const cached = SessionFeedback({ ...props, data: [] });
    assert.ok(nodes(cached).some((node) => node.type === "Cooldown"));
    assert.ok(JSON.stringify(cached).includes("Cached session"));
    const denied = SessionFeedback({
      ...props,
      data: [],
      error: new AppError("http", 403),
      denial: "forbidden",
    });
    assert.equal(JSON.stringify(denied).includes("Cached session"), false);
    assert.equal(
      nodes(denied).find((node) => node.type === "Empty")?.props.title,
      "Không có quyền xem buổi học",
    );
    const quietInitial = SessionFeedback({ ...props, quietTransient: true });
    assert.equal(nodes(quietInitial)[0]?.type, "Loading");
    assert.equal(
      nodes(quietInitial).some(
        (node) => node.type === "Cooldown" || node.type === "Notice",
      ),
      false,
    );
    const quietCached = SessionFeedback({
      ...props,
      data: [],
      quietTransient: true,
    });
    assert.ok(JSON.stringify(quietCached).includes("Cached session"));
    assert.equal(
      nodes(quietCached).some(
        (node) => node.type === "Cooldown" || node.type === "Notice",
      ),
      false,
    );
    const quietDenied = SessionFeedback({
      ...props,
      data: [],
      quietTransient: true,
      denial: "forbidden",
      error: new AppError("http", 403),
    });
    assert.equal(JSON.stringify(quietDenied).includes("Cached session"), false);
  } finally {
    delete local.cache[filename];
    contexts.reverse().forEach((context) => context.restore());
  }
});
