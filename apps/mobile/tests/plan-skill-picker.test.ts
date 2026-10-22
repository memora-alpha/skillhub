import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
type Element = { type: unknown; props: Record<string, unknown> };
function elements(tree: unknown): Element[] {
  if (Array.isArray(tree)) return tree.flatMap(elements);
  if (!tree || typeof tree !== "object" || !("props" in tree)) return [];
  const value = tree as Element;
  return [value, ...elements(value.props.children)];
}
test("skill picker hides unselected catalog options until expanded, then selects by UUID and collapses", () => {
  const local = createRequire(
    new URL(
      "../src/features/learning-paths/components/plan-editor-fields.tsx",
      import.meta.url,
    ),
  );
  const filename = local.resolve("./plan-editor-fields.tsx");
  let expanded = false;
  let search = "";
  const jsx = (type: unknown, props: Record<string, unknown>) => ({
    type,
    props,
  });
  const stubs: Record<string, Record<string, unknown>> = {
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "Fragment" },
    react: {
      useState: (initial: unknown) =>
        typeof initial === "string"
          ? [
              search,
              (value: string) => {
                search = value;
              },
            ]
          : [
              expanded,
              (value: boolean) => {
                expanded = value;
              },
            ],
    },
    "react-native": {
      View: "View",
      Text: "Text",
      Pressable: "Pressable",
      TextInput: "TextInput",
      StyleSheet: { create: (value: unknown) => value, hairlineWidth: 1 },
    },
    "react-hook-form": { useWatch: () => "" },
    "@/components/KeyboardFormScrollView": { KeyboardFormScrollView: "Scroll" },
    "@/components/ControlledInput": { ControlledInput: "Input" },
    "@/components/Button": { Button: "Button" },
    "@/components/Icon": { Icon: "Icon" },
  };
  const mocks = Object.entries(stubs).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  try {
    delete local.cache[filename];
    const { PlanSkillPicker } = local(
      filename,
    ) as typeof import("../src/features/learning-paths/components/plan-editor-fields");
    const selected: string[] = [];
    const props = {
      options: [
        { id: "first", name: "React" },
        { id: "second", name: "React" },
      ],
      value: "second",
      disabled: false,
      onChange: (id: string) => {
        selected.push(id);
      },
      hasMore: true,
      onLoadMore: () => {},
    };
    let tree = elements(PlanSkillPicker(props));
    assert.equal(
      tree.filter((item) => item.props.accessibilityRole === "radio").length,
      0,
    );
    assert.equal(
      tree.filter(
        (item) => item.props.accessibilityLabel === "Kỹ năng đang chọn: React",
      ).length,
      1,
    );
    assert.equal(
      tree.some((item) => item.props.children === "Tải thêm kỹ năng"),
      false,
    );
    (
      tree.find((item) => item.props.accessibilityLabel === "Xem thêm kỹ năng")!
        .props.onPress as () => void
    )();
    tree = elements(PlanSkillPicker(props));
    const choices = tree.filter(
      (item) => item.props.accessibilityRole === "radio",
    );
    assert.equal(choices.length, 2);
    assert.equal(choices[1]!.props["aria-checked"], true);
    const searchInput = tree.find((item) => item.type === "TextInput")!;
    (searchInput.props.onChangeText as (value: string) => void)("missing");
    assert.equal(
      elements(PlanSkillPicker(props)).filter(
        (item) => item.props.accessibilityRole === "radio",
      ).length,
      0,
    );
    (searchInput.props.onChangeText as (value: string) => void)(" rEaCt ");
    assert.equal(
      elements(PlanSkillPicker(props)).filter(
        (item) => item.props.accessibilityRole === "radio",
      ).length,
      2,
    );
    (choices[0]!.props.onPress as () => void)();
    assert.deepEqual(selected, ["first"]);
    assert.equal(expanded, false);
    assert.equal(search, "");
    tree = elements(PlanSkillPicker({ ...props, value: "first" }));
    assert.equal(
      tree.filter((item) => item.props.accessibilityRole === "radio").length,
      0,
    );
    const unpaged = elements(
      PlanSkillPicker({
        ...props,
        options: [],
        selectedName: "Kỹ năng ngoài trang hiện tại",
      }),
    );
    assert.ok(
      unpaged.some(
        (item) =>
          item.props.accessibilityLabel ===
          "Kỹ năng đang chọn: Kỹ năng ngoài trang hiện tại",
      ),
    );
  } finally {
    delete local.cache[filename];
    mocks.reverse().forEach((item) => item.restore());
  }
});
