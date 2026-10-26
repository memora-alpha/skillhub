import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import { ScreenLoadingContent as WebContent } from "../src/components/ScreenLoadingContent.web";

test("web waiting content is inert to keyboard/focus while retaining its form markup and geometry", () => {
  const children = createElement("input", {
    defaultValue: "draft",
    "aria-label": "Draft",
  });
  const waiting = renderToStaticMarkup(
    createElement(WebContent, { waiting: true, children }),
  );
  assert.match(waiting, /inert=""/);
  assert.match(waiting, /visibility:hidden/);
  assert.match(waiting, /value="draft"/);
  assert.doesNotMatch(waiting, /display:none/);
  const ready = renderToStaticMarkup(
    createElement(WebContent, { waiting: false, children }),
  );
  assert.doesNotMatch(ready, /\binert=/);
  assert.match(ready, /visibility:visible/);
  assert.match(ready, /value="draft"/);
});

test("native waiting content dismisses existing keyboard focus once and keeps its draft mounted", () => {
  const local = createRequire(
    new URL("../src/components/ScreenLoadingContent.tsx", import.meta.url),
  );
  const filename = local.resolve("./ScreenLoadingContent.tsx");
  let previous: unknown;
  let dismissed = 0;
  const jsx = (type: unknown, props: unknown) => ({ type, props });
  const contexts = [
    mock.module(pathToFileURL(local.resolve("react")), {
      namedExports: {
        useEffect: (effect: () => void, deps: unknown[]) => {
          if (previous !== deps[0]) {
            previous = deps[0];
            effect();
          }
        },
      },
    }),
    mock.module(pathToFileURL(local.resolve("react/jsx-runtime")), {
      namedExports: { jsx },
    }),
    mock.module(pathToFileURL(local.resolve("react-native")), {
      namedExports: { View: "View", Keyboard: { dismiss: () => dismissed++ } },
    }),
  ];
  try {
    delete local.cache[filename];
    const { ScreenLoadingContent } = local(filename) as {
      ScreenLoadingContent: (props: unknown) => {
        props: Record<string, unknown>;
      };
    };
    const child = { type: "Input", props: { value: "draft" } };
    const render = (waiting: boolean) =>
      ScreenLoadingContent({ waiting, children: child }).props;
    render(false);
    assert.equal(dismissed, 0);
    const hidden = render(true);
    assert.equal(dismissed, 1);
    assert.equal(hidden.children, child);
    assert.equal(hidden.pointerEvents, "none");
    assert.equal(hidden.importantForAccessibility, "no-hide-descendants");
    render(true);
    assert.equal(dismissed, 1);
    assert.equal(render(false).pointerEvents, "auto");
    assert.equal(
      dismissed,
      1,
      "finishing a read must not reopen or refocus the keyboard",
    );
  } finally {
    delete local.cache[filename];
    for (const context of contexts.reverse()) context.restore();
  }
});
