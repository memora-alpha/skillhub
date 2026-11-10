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

test("hour and minute wheels support swipes, taps and accessibility without changing the date", () => {
  const local = createRequire(
    new URL("../src/components/TimeWheelPicker.tsx", import.meta.url),
  );
  const filename = local.resolve("./TimeWheelPicker.tsx");
  const jsx = (type: unknown, props: Record<string, unknown>) => ({
    type,
    props,
  });
  const stubs = {
    "react/jsx-runtime": { jsx, jsxs: jsx },
    react: {
      useRef: (current: unknown) => ({ current }),
      useEffect: (effect: () => void) => effect(),
    },
    "react-native": {
      Pressable: "Pressable",
      ScrollView: "ScrollView",
      View: "View",
      Text: "Text",
      StyleSheet: { create: (value: unknown) => value },
    },
  };
  const mocks = Object.entries(stubs).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  try {
    delete local.cache[filename];
    const { TimeWheelPicker } = local(
      filename,
    ) as typeof import("../src/components/TimeWheelPicker");
    const initial = new Date(2030, 1, 10, 19, 35);
    let selected = initial;
    const tree = TimeWheelPicker({
      value: initial,
      onChange: (value) => {
        selected = value;
      },
    });
    const columns = elements(tree).filter(
      (element) => typeof element.type === "function",
    );
    const hour = (columns[0]!.type as (props: unknown) => Element)(
      columns[0]!.props,
    );
    const minute = (columns[1]!.type as (props: unknown) => Element)(
      columns[1]!.props,
    );
    const swipe = (column: Element, y: number) => {
      const scroller = elements(column).find(
        (element) => element.type === "ScrollView",
      )!;
      assert.equal(scroller.props.nestedScrollEnabled, true);
      (scroller.props.onContentSizeChange as () => void)();
      const row = Number(scroller.props.snapToInterval);
      (scroller.props.onScroll as (event: unknown) => void)({
        nativeEvent: { contentOffset: { y: y * row } },
      });
    };
    swipe(hour, 22.8);
    assert.equal(selected.getHours(), 23);
    assert.equal(selected.getMinutes(), 35);
    swipe(minute, 58.8);
    assert.equal(selected.getMinutes(), 59);
    assert.equal(
      selected.getHours(),
      23,
      "a minute event before the next render preserves the just-selected hour",
    );
    swipe(hour, 19);
    assert.equal(
      selected.getHours(),
      19,
      "scrolling back before a render is not ignored",
    );
    assert.equal(selected.getMinutes(), 59);
    swipe(hour, 22.8);
    swipe(minute, 100);
    assert.equal(selected.getMinutes(), 59);
    swipe(hour, -10);
    assert.equal(selected.getHours(), 0);
    const taps = elements(minute).filter(
      (element) => element.type === "Pressable",
    );
    (taps[0]!.props.onPress as () => void)();
    assert.equal(selected.getMinutes(), 0);
    assert.equal(
      selected.getHours(),
      0,
      "a tap preserves the last selected hour",
    );
    const adjustable = elements(hour).find(
      (element) => element.props.accessibilityRole === "adjustable",
    )!;
    (adjustable.props.onAccessibilityAction as (event: unknown) => void)({
      nativeEvent: { actionName: "increment" },
    });
    assert.equal(selected.getHours(), 1);
    assert.equal(selected.getFullYear(), 2030);
    assert.equal(selected.getMonth(), 1);
    assert.equal(selected.getDate(), 10);
    assert.equal(initial.getHours(), 19);
    assert.equal(initial.getMinutes(), 35);
  } finally {
    delete local.cache[filename];
    for (const context of mocks.reverse()) context.restore();
  }
});
