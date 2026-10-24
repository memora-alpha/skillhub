import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import { AppError } from "../src/lib/http/errors";

type Element = { type: unknown; props: Record<string, unknown> };
function elements(value: unknown): Element[] {
  if (Array.isArray(value)) return value.flatMap(elements);
  if (!value || typeof value !== "object" || !("props" in value)) return [];
  const element = value as Element;
  return [element, ...elements(element.props.children)];
}
test("rate limits have calm inline feedback without retry; other failures keep a small retry", () => {
  const local = createRequire(
    new URL("../src/features/connections/components.tsx", import.meta.url),
  );
  const filename = local.resolve("./components.tsx");
  const jsx = (type: unknown, props: Record<string, unknown>) => ({
    type,
    props,
  });
  const stubs = {
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "react-native": {
      ActivityIndicator: "Spinner",
      View: "View",
      Text: "Text",
      Pressable: "Pressable",
      StyleSheet: { create: (value: unknown) => value },
    },
    "@/components/Icon": { Icon: "Icon" },
    "@/components/LoadingIndicator": { LoadingIndicator: "Spinner" },
  };
  const mocks = Object.entries(stubs).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  try {
    delete local.cache[filename];
    const { ConnectionFeedback } = local(
      filename,
    ) as typeof import("../src/features/connections/components");
    let retries = 0;
    const retry = () => {
      retries++;
    };
    const limited = elements(
      ConnectionFeedback({ error: new AppError("http", 429), retry }),
    );
    assert.equal(
      limited.some((item) => item.type === "Pressable"),
      false,
    );
    assert.ok(
      limited.some(
        (item) =>
          item.props.children ===
          "Tạm thời có nhiều yêu cầu. Vui lòng đợi một lát.",
      ),
    );
    const button = elements(
      ConnectionFeedback({ error: new AppError("network"), retry }),
    ).find((item) => item.type === "Pressable")!;
    (button.props.onPress as () => void)();
    assert.equal(retries, 1);
    const pending = elements(
      ConnectionFeedback({
        loading: true,
        error: new AppError("network"),
        retry,
      }),
    ).find((item) => item.type === "Pressable")!;
    (pending.props.onPress as () => void)();
    assert.equal(retries, 1);
    assert.equal(ConnectionFeedback({}), null);
  } finally {
    delete local.cache[filename];
    mocks.reverse().forEach((item) => item.restore());
  }
});
