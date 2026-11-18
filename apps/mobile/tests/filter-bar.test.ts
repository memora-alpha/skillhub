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

test("shared filters preserve selection semantics, disabled controls and reveal the selected option", () => {
  const local = createRequire(
    new URL("../src/components/filter-bar.tsx", import.meta.url),
  );
  const filename = local.resolve("./filter-bar.tsx");
  const refs: { current: unknown }[] = [];
  const effects: (() => void)[] = [];
  let cursor = 0;
  const jsx = (type: unknown, props: unknown) => ({ type, props });
  const contexts = Object.entries({
    react: {
      useRef(value: unknown) {
        return (refs[cursor++] ??= { current: value });
      },
      useEffect(effect: () => void) {
        effects.push(effect);
      },
    },
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "react-native": {
      View: "View",
      Text: "Text",
      Pressable: "Pressable",
      ScrollView: "ScrollView",
      Platform: { OS: "ios" },
      StyleSheet: { create: (styles: unknown) => styles },
    },
  }).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  try {
    delete local.cache[filename];
    const { FilterBar } = local(filename);
    const changed: string[] = [];
    const options = [
      { value: "a", label: "Tất cả" },
      { value: "b", label: "Đang học" },
    ];
    const render = (
      value: string,
      role: "button" | "radio" | "tab",
      disabled = false,
    ) => {
      cursor = 0;
      return elements(
        FilterBar({
          options,
          value,
          role,
          disabled,
          label: "Lọc",
          onChange: (next: string) => changed.push(next),
        }),
      );
    };
    const scroll = mock.fn();
    const first = render("a", "radio");
    refs[0]!.current = { scrollTo: scroll };
    const layouts = first.filter((node) => node.props.onLayout);
    layouts.forEach((node, index) =>
      (node.props.onLayout as (event: unknown) => void)({
        nativeEvent: { layout: { x: index * 120 } },
      }),
    );
    const buttons = first.filter((node) => node.type === "Pressable");
    assert.deepEqual(
      buttons.map((node) => node.props["aria-checked"]),
      [true, false],
    );
    assert.ok(
      first.some((node) => node.props.accessibilityRole === "radiogroup"),
    );
    (buttons[1]!.props.onPress as () => void)();
    assert.deepEqual(changed, ["b"]);
    effects.splice(0).forEach((effect) => effect());
    render("b", "radio");
    effects.splice(0).forEach((effect) => effect());
    assert.deepEqual(scroll.mock.calls.at(-1)?.arguments, [
      { x: 116, animated: false },
    ]);
    const tabs = render("b", "tab", true);
    assert.ok(tabs.some((node) => node.props.accessibilityRole === "tablist"));
    for (const node of tabs.filter((item) => item.type === "Pressable")) {
      assert.equal(node.props.disabled, true);
      assert.equal(
        (node.props.accessibilityState as { disabled: boolean }).disabled,
        true,
      );
    }
    const plain = render("a", "button");
    assert.deepEqual(
      plain
        .filter((node) => node.type === "Pressable")
        .map((node) => node.props["aria-pressed"]),
      [true, false],
    );
  } finally {
    delete local.cache[filename];
    contexts.reverse().forEach((context) => context.restore());
  }
});
