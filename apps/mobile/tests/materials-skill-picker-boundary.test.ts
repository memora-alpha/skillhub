import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";

test("skill picker mounts its list only while open and dismisses during a pending read", () => {
  const local = createRequire(
    new URL(
      "../src/features/materials/components/material-skill-picker.tsx",
      import.meta.url,
    ),
  );
  let open = false,
    stateIndex = 0,
    dismissed = 0;
  let enabled: boolean | undefined;
  let readOptions: unknown;
  const selected: string[] = [];
  const contexts = Object.entries({
    react: {
      useState: (value: unknown) => [
        stateIndex++ === 0 ? open : value,
        (next: boolean) => {
          if (typeof next === "boolean") open = next;
        },
      ],
      useEffect() {},
    },
    "react/jsx-runtime": {
      jsx: (type: unknown, props: unknown) => ({ type, props }),
      jsxs: (type: unknown, props: unknown) => ({ type, props }),
    },
    "react-native": {
      View: "View",
      Text: "Text",
      Pressable: "Pressable",
      Modal: "NativeModal",
      Keyboard: {
        dismiss: () => {
          dismissed++;
        },
      },
      StyleSheet: { create: (value: unknown) => value },
    },
    "@/components/SafeArea": { SafeAreaView: "SafeAreaView" },
    "@/components/ScreenLoadingBoundary": {
      ScreenLoadingBoundary: "LoadingBoundary",
    },
    "@/components/Button": { Button: "Button" },
    "@/components/Input": { Input: "Input" },
    "@/components/Icon": { Icon: "Icon" },
    "@/components/RefreshableFlatList": {
      RefreshableFlatList: "VirtualizedSkills",
    },
    "./material-skill-sheet": { MaterialSkillSheet: "SkillSheet" },
    "@/features/connections": {
      useCatalogName: () => ({}),
      useConnectionList: (
        _key: unknown,
        _read: unknown,
        active: boolean,
        options: unknown,
      ) => {
        enabled = active;
        readOptions = options;
        return { items: [], isLoading: true };
      },
      ConnectionFeedback: "ConnectionFeedback",
    },
    "../hooks/use-materials": { useMaterialsApi: () => ({ skills() {} }) },
  }).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  const file = local.resolve("./material-skill-picker.tsx");
  type Node = { type?: string; props?: Record<string, unknown> };
  const find = (
    tree: unknown,
    type: string,
    parents: string[] = [],
  ): { node: Node; parents: string[] } | undefined => {
    if (!tree || typeof tree !== "object") return;
    const node = tree as Node;
    if (node.type === type) return { node, parents };
    for (const child of [node.props?.children].flat()) {
      const result = find(child, type, [...parents, node.type ?? "unknown"]);
      if (result) return result;
    }
  };
  try {
    delete local.cache[file];
    const { MaterialSkillPicker } = local(file);
    const closed = MaterialSkillPicker({
      value: "",
      onChange: (id: string) => selected.push(id),
    });
    assert.equal(enabled, false);
    assert.equal(find(closed, "VirtualizedSkills"), undefined);
    open = true;
    stateIndex = 0;
    const opened = MaterialSkillPicker({
      value: "",
      onChange: (id: string) => selected.push(id),
    });
    assert.equal(enabled, true);
    assert.deepEqual(readOptions, { cancelOnDisable: true });
    const list = find(opened, "VirtualizedSkills");
    assert.ok(list);
    assert.ok(
      list.parents.includes("SkillSheet"),
      "the list must stay inside its isolated modal sheet",
    );
    assert.ok(list.parents.includes("LoadingBoundary"));
    const sheet = find(opened, "SkillSheet");
    assert.ok(sheet);
    (sheet.node.props?.onClose as () => void)();
    assert.equal(open, false);
    const render = list.node.props?.renderItem as (input: {
      item: { id: string; name: string };
    }) => Node;
    const row = render({ item: { id: "skill-id", name: "Tiếng Anh" } });
    (row.props?.onPress as () => void)();
    assert.deepEqual(selected, ["skill-id"]);
    assert.equal(dismissed, 2);
  } finally {
    contexts.forEach((context) => context.restore());
    delete local.cache[file];
  }
});

test("skill sheet isolates list contexts, waits for its modal, and supports drag, close and Back", () => {
  const local = createRequire(
    new URL(
      "../src/features/materials/components/material-skill-sheet.tsx",
      import.meta.url,
    ),
  );
  type Node = { type: unknown; props: Record<string, unknown> };
  const nodes = (tree: unknown): Node[] => {
    if (Array.isArray(tree)) return tree.flatMap(nodes);
    if (!tree || typeof tree !== "object" || !("props" in tree)) return [];
    const node = tree as Node;
    return [node, ...nodes(node.props.children)];
  };
  const states: unknown[] = [];
  let index = 0,
    height = 800,
    closes = 0;
  const jsx = (type: unknown, props: unknown): unknown =>
    typeof type === "function" && type.name === "PickerSheetHeader"
      ? type(props)
      : { type, props };
  const mocks = {
    react: {
      useState: (initial: unknown) => {
        const key = index++;
        if (!(key in states))
          states[key] = typeof initial === "function" ? initial() : initial;
        return [
          states[key],
          (value: unknown) => {
            states[key] = value;
          },
        ];
      },
      useMemo: (fn: () => unknown) => fn(),
    },
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "react-native": {
      Modal: "NativeModal",
      View: "View",
      Text: "Text",
      Pressable: "Pressable",
      useWindowDimensions: () => ({ height }),
    },
    "@expo/ui": {
      Host: "Host",
      BottomSheet: "Sheet",
      RNHostView: "RNHostView",
    },
    "@/components/SafeArea": { SafeAreaView: "SafeAreaView" },
    "@/components/Icon": { Icon: "Icon" },
    "@/components/Button": { Button: "Button" },
  };
  const contexts = Object.entries(mocks).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  const filename = local.resolve("./material-skill-sheet.tsx");
  try {
    delete local.cache[filename];
    const { MaterialSkillSheet } = local(filename);
    const render = () => {
      index = 0;
      return nodes(
        MaterialSkillSheet({
          onClose: () => closes++,
          children: jsx("LoadingBoundary", { children: jsx("List", {}) }),
        }),
      );
    };
    const before = render();
    const modal = before.find((n) => n.type === "NativeModal")!;
    assert.ok(nodes(modal).some((n) => n.type === "List"));
    assert.equal(modal.props.transparent, true);
    assert.equal(
      before.find((n) => n.type === "Sheet")!.props.isPresented,
      false,
    );
    (modal.props.onShow as () => void)();
    height = 420;
    const shown = render();
    const sheet = shown.find((n) => n.type === "Sheet")!;
    assert.equal(sheet.props.isPresented, true);
    assert.equal(sheet.props.showDragIndicator, true);
    assert.deepEqual(sheet.props.snapPoints, [{ height: 640 }]);
    const safeArea = shown.find((n) => n.type === "SafeAreaView")!;
    assert.deepEqual(safeArea.props.edges, ["bottom"]);
    const header = (safeArea.props.children as Node[])[0];
    assert.ok(header);
    const close = nodes(header).find(
      (n) => n.props.accessibilityLabel === "Đóng bộ chọn kỹ năng",
    )!;
    assert.equal(close.type, "Pressable");
    assert.ok(!nodes(header).some((n) => n.type === "LoadingBoundary"));
    assert.equal((header.props.style as { paddingTop: number }).paddingTop, 12);
    (close.props.onPress as () => void)();
    (modal.props.onRequestClose as () => void)();
    (sheet.props.onDismiss as () => void)();
    assert.equal(closes, 3);
  } finally {
    delete local.cache[filename];
    contexts.forEach((context) => context.restore());
  }
});
