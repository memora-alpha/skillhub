import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  webSafeAreaSpacing,
  webSafeAreaPosition,
} from "../src/utils/web-safe-area";

test("modal gutters add safe area after resolving side, axis and general spacing", () => {
  const style = webSafeAreaSpacing({
    padding: 24,
    paddingHorizontal: 16,
    paddingTop: 8,
  });
  assert.equal(style.paddingTop, "calc(8px + env(safe-area-inset-top, 0px))");
  assert.equal(
    style.paddingRight,
    "calc(16px + env(safe-area-inset-right, 0px))",
  );
  assert.equal(
    style.paddingBottom,
    "calc(24px + env(safe-area-inset-bottom, 0px))",
  );
});

test("tab content does not add a second bottom inset and a disabled edge preserves its spacing", () => {
  const style = webSafeAreaSpacing({ padding: 12 }, ["top", "left", "right"]);
  assert.equal(style.paddingBottom, undefined);
  assert.equal(style.paddingTop, "calc(12px + env(safe-area-inset-top, 0px))");
  assert.deepEqual(webSafeAreaSpacing({ padding: 24 }, []), {});
});

test("edge maximum and margin mode preserve the caller's spacing policy", () => {
  const style = webSafeAreaSpacing(
    { margin: 16, marginBottom: 32 },
    { bottom: "maximum", top: "off" },
    "margin",
  );
  assert.deepEqual(style, {
    marginBottom: "max(32px, env(safe-area-inset-bottom, 0px))",
  });
});

test("menu offsets stay bound to browser insets without reading layout into React state", () => {
  assert.deepEqual(webSafeAreaPosition({ top: 56, right: 16 }), {
    top: "calc(env(safe-area-inset-top, 0px) + 56px)",
    right: "calc(env(safe-area-inset-right, 0px) + 16px)",
  });
});

test("web adapter renders CSS spacing and children without a measuring provider", async () => {
  const native = mock.module("react-native", {
    namedExports: {
      StyleSheet: { flatten: (style: unknown) => style },
      View: ({ style, ...props }: { style: object[] }) =>
        createElement("div", { ...props, style: Object.assign({}, ...style) }),
    },
  });
  try {
    const { SafeAreaView, SafeAreaProvider } =
      await import("../src/components/SafeArea.web");
    const html = renderToStaticMarkup(
      createElement(
        SafeAreaProvider,
        {},
        createElement(
          SafeAreaView,
          { style: { padding: 24 }, edges: ["top"] },
          "Content",
        ),
      ),
    );
    assert.match(
      html,
      /padding-top:calc\(24px \+ env\(safe-area-inset-top, 0px\)\)/,
    );
    assert.match(html, />Content<\/div>/);
    assert.doesNotMatch(
      html,
      /padding-bottom:|ResizeObserver|safe-area-inset-bottom/,
    );
  } finally {
    native.restore();
  }
});
