import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";

test("closed, locked or disabled catalog selectors do not enable background reads", () => {
  const local = createRequire(
    new URL(
      "../src/features/learning-requests/components/skill-selector.tsx",
      import.meta.url,
    ),
  );
  const skillFile = local.resolve("./skill-selector.tsx"),
    tagFile = local.resolve("./tag-selector.tsx");
  let expanded = false;
  const skills: unknown[][] = [],
    tags: unknown[][] = [];
  const jsx = (type: unknown, props: unknown): unknown =>
    typeof type === "function" && type.name === "PickerSheetHeader"
      ? type(props)
      : { type, props };
  const mocks = {
    react: {
      useState: (initial: unknown) => [
        typeof initial === "boolean" ? expanded : initial,
        () => {},
      ],
      useEffect() {},
      useRef: (initial: unknown) => ({ current: initial }),
    },
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "Fragment" },
    "react-native": { Pressable: "Pressable", Text: "Text", View: "View" },
    "@/components/Input": { Input: "Input" },
    "@/components/Button": { Button: "Button" },
    "@/components/feature-page": { Copy: "Copy" },
    "@/components/FormNotice": { FormNotice: "Notice" },
    "@/components/Icon": { Icon: "Icon" },
    "../hooks/use-requests": {
      useSkillOptions: (...args: unknown[]) => {
        skills.push(args);
        return {};
      },
      useSkillName: () => ({}),
    },
    "../hooks/use-request-options": {
      useTagOptions: (...args: unknown[]) => {
        tags.push(args);
        return {};
      },
    },
    "./request-state": { RequestFailure: "Failure", RequestLoading: "Loading" },
    "./request-form.styles": { requestFormColors: {}, requestFormStyles: {} },
    "./request-multi-select": { RequestMultiSelect: "MultiSelect" },
    "./request-picker-sheet": { RequestPickerSheet: "PickerSheet" },
  };
  const contexts = Object.entries(mocks).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  try {
    delete local.cache[skillFile];
    delete local.cache[tagFile];
    const { SkillSelector } = local(
      skillFile,
    ) as typeof import("../src/features/learning-requests/components/skill-selector");
    const { TagSelector } = local(
      tagFile,
    ) as typeof import("../src/features/learning-requests/components/tag-selector");
    const render = (disabled = false, locked = false) => {
      SkillSelector({ value: "", onChange() {}, disabled, locked });
      TagSelector({ value: [], onChange() {}, disabled });
    };
    render();
    assert.equal(skills.at(-1)?.[1], false);
    assert.equal(tags.at(-1)?.[1], false);
    expanded = true;
    render();
    assert.equal(skills.at(-1)?.[1], true);
    assert.equal(tags.at(-1)?.[1], true);
    render(true);
    assert.equal(skills.at(-1)?.[1], false);
    assert.equal(tags.at(-1)?.[1], false);
    render(false, true);
    assert.equal(skills.at(-1)?.[1], false);
    expanded = false;
    SkillSelector({ value: "", onChange() {}, active: false });
    TagSelector({ value: ["selected-tag"], onChange() {}, active: false });
    assert.equal(skills.at(-1)?.[1], false);
    assert.equal(tags.at(-1)?.[1], false);
    TagSelector({ value: ["selected-tag"], disabled: true, onChange() {} });
    assert.equal(
      tags.at(-1)?.[1],
      true,
      "existing tag labels still load in a readonly form",
    );
  } finally {
    delete local.cache[skillFile];
    delete local.cache[tagFile];
    contexts.reverse().forEach((context) => context.restore());
  }
});

test("shared request picker isolates loading in its body and leaves close available", () => {
  const local = createRequire(
    new URL(
      "../src/features/learning-requests/components/request-picker-sheet.tsx",
      import.meta.url,
    ),
  );
  const file = local.resolve("./request-picker-sheet.tsx");
  let dismissed = 0,
    closed = 0;
  const jsx = (type: unknown, props: unknown): unknown =>
    typeof type === "function" && type.name === "PickerSheetHeader"
      ? type(props)
      : { type, props };
  const contexts = Object.entries({
    react: {
      useMemo: (fn: () => unknown) => fn(),
      useRef: (current: unknown) => ({ current }),
    },
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "react-native": {
      View: "View",
      Text: "Text",
      Pressable: "Pressable",
      useWindowDimensions: () => ({ height: 844 }),
      Keyboard: { dismiss: () => dismissed++ },
    },
    "@expo/ui": {
      Host: "Host",
      BottomSheet: "Sheet",
      RNHostView: "RNHostView",
    },
    "@/components/Icon": { Icon: "Icon" },
    "@/components/Button": { Button: "Button" },
    "@/components/KeyboardFormScrollView": { KeyboardFormScrollView: "Body" },
    "@/components/ScreenLoadingBoundary": {
      ScreenLoadingBoundary: "LoadingBoundary",
    },
  }).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  type Node = { type: string; props: Record<string, unknown> };
  function nodes(
    tree: unknown,
    parents: string[] = [],
  ): { node: Node; parents: string[] }[] {
    if (Array.isArray(tree))
      return tree.flatMap((child) => nodes(child, parents));
    if (!tree || typeof tree !== "object" || !("props" in tree)) return [];
    const node = tree as Node;
    return [
      { node, parents },
      ...nodes(node.props.children, [...parents, node.type]),
    ];
  }
  try {
    delete local.cache[file];
    const { RequestPickerSheet } = local(file);
    const result = nodes(
      RequestPickerSheet({
        title: "Kỹ năng",
        open: true,
        onClose: () => closed++,
        children: "Pending skills",
        closeIcon: true,
        closeLabel: "Đóng bộ chọn kỹ năng",
      }),
    );
    const body = result.find(({ node }) => node.type === "Body");
    assert.ok(body?.parents.includes("LoadingBoundary"));
    const close = result.find(
      ({ node }) => node.props.accessibilityLabel === "Đóng bộ chọn kỹ năng",
    );
    assert.ok(close);
    assert.ok(!close.parents.includes("LoadingBoundary"));
    (close.node.props.onPress as () => void)();
    const sheet = result.find(({ node }) => node.type === "Sheet");
    (sheet?.node.props.onDismiss as () => void)();
    assert.equal(closed, 2);
    assert.equal(dismissed, 2);
  } finally {
    contexts.reverse().forEach((context) => context.restore());
    delete local.cache[file];
  }
});
