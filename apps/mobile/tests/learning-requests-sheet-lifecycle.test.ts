import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";

type Element = { type: unknown; props: Record<string, unknown> };
function nodes(tree: unknown): Element[] {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== "object" || !("props" in tree)) return [];
  const element = tree as Element;
  return [element, ...nodes(element.props.children)];
}
test("closing sheet retains its height through keyboard resize and icon dismisses once", () => {
  const local = createRequire(
    new URL(
      "../src/features/learning-requests/components/request-picker-sheet.tsx",
      import.meta.url,
    ),
  );
  const filename = local.resolve("./request-picker-sheet.tsx");
  const ref = { current: undefined as unknown };
  let height = 800,
    closes = 0,
    keyboardDismissals = 0;
  const jsx = (type: unknown, props: unknown) => ({ type, props });
  const mocks = {
    react: {
      useRef: (initial: unknown) => {
        ref.current ??= initial;
        return ref;
      },
      useMemo: (fn: () => unknown) => fn(),
    },
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "react-native": {
      View: "View",
      Text: "Text",
      Pressable: "Pressable",
      Keyboard: { dismiss: () => keyboardDismissals++ },
      useWindowDimensions: () => ({ height }),
    },
    "@expo/ui": {
      Host: "Host",
      BottomSheet: "Sheet",
      RNHostView: "RNHostView",
    },
    "@/components/Button": { Button: "Button" },
    "@/components/Icon": { Icon: "Icon" },
    "@/components/KeyboardFormScrollView": { KeyboardFormScrollView: "Scroll" },
  };
  const contexts = Object.entries(mocks).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  try {
    delete local.cache[filename];
    const { RequestPickerSheet } = local(filename);
    const render = (open: boolean) =>
      nodes(
        RequestPickerSheet({
          title: "Bộ lọc",
          open,
          onClose: () => closes++,
          closeIcon: true,
          closeLabel: "Đóng bộ lọc",
          children: jsx("Input", {}),
        }),
      );
    const before = render(true).find((n) => n.type === "Sheet")!;
    assert.deepEqual(before.props.snapPoints, [{ height: 640 }]);
    height = 420;
    const keyboardOpen = render(true);
    assert.deepEqual(
      keyboardOpen.find((n) => n.type === "Sheet")!.props.snapPoints,
      before.props.snapPoints,
    );
    const closeButton = keyboardOpen.find(
      (n) => n.props.accessibilityLabel === "Đóng bộ lọc",
    )!;
    assert.equal(closeButton.type, "Pressable");
    assert.equal(
      nodes(closeButton).find((n) => n.type === "Icon")!.props.name,
      "close",
    );
    (closeButton.props.onPress as () => void)();
    assert.equal(closes, 1);
    assert.equal(keyboardDismissals, 1);
    const closing = render(false).find((n) => n.type === "Sheet")!;
    assert.equal(closing.props.isPresented, false);
    assert.deepEqual(closing.props.snapPoints, before.props.snapPoints);
    height = 800;
    assert.deepEqual(
      render(false).find((n) => n.type === "Sheet")!.props.snapPoints,
      before.props.snapPoints,
    );
  } finally {
    delete local.cache[filename];
    contexts.reverse().forEach((c) => c.restore());
  }
});
