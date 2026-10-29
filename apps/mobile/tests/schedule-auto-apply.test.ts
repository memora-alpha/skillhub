import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";

test("weekly template applies only on button press and preserves individual changes while editing options", () => {
  const local = createRequire(
    new URL(
      "../src/features/learning-paths/components/schedule-weekly-generator.tsx",
      import.meta.url,
    ),
  );
  const filename = local.resolve("./schedule-weekly-generator.tsx");
  const state: unknown[] = [];
  let cursor = 0;
  const jsx = (type: unknown, props: unknown) => ({ type, props });
  const contexts = Object.entries({
    "react/jsx-runtime": { jsx, jsxs: jsx },
    react: {
      useState: (initial: unknown) => {
        const index = cursor++;
        if (!(index in state)) state[index] = initial;
        return [
          state[index],
          (value: unknown) => {
            state[index] = value;
          },
        ];
      },
    },
    "react-native": {
      View: "View",
      Text: "Text",
      Pressable: "Pressable",
      StyleSheet: { create: (v: unknown) => v },
    },
    "./schedule-time-fields": { ScheduleTimeFields: "TimeFields" },
    "@/components/Button": { Button: "Button" },
    "@/components/learning-flow": { FlowSection: "Section" },
    "@/components/Icon": { Icon: "Icon" },
  }).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  type Items = { local: string; minutes: string }[];
  type Element = {
    type: string;
    props: {
      children?: unknown;
      accessibilityLabel?: string;
      onPress: () => void;
      onLocalChange: (value: string) => void;
      onMinutesChange: (value: string) => void;
    };
  };
  const nodes = (tree: unknown): Element[] => {
    if (Array.isArray(tree)) return tree.flatMap(nodes);
    if (!tree || typeof tree !== "object" || !("props" in tree)) return [];
    const element = tree as Element;
    return [element, ...nodes(element.props.children)];
  };
  const calls: Items[] = [];
  try {
    delete local.cache[filename];
    const { ScheduleWeeklyGenerator } = local(filename);
    const render = (disabled = false) => {
      cursor = 0;
      return nodes(
        ScheduleWeeklyGenerator({
          count: 2,
          disabled,
          onApply: (items: Items) => calls.push(items),
        }),
      );
    };
    let tree = render();
    tree.find((e) => e.props.accessibilityLabel === "Thứ 3")!.props.onPress();
    assert.equal(calls.length, 0);
    tree = render();
    tree
      .find((e) => e.type === "TimeFields")!
      .props.onLocalChange("2098-02-01T15:00");
    assert.equal(calls.length, 0);
    tree = render();
    const apply = () =>
      render()
        .find((e) => e.type === "Button")!
        .props.onPress();
    assert.equal(
      tree.find((e) => e.type === "Button")!.props.children,
      "Áp dụng cho 2 buổi",
    );
    apply();
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.length, 2);
    calls[0]![0]!.minutes = "120";
    tree = render();
    tree.find((e) => e.props.accessibilityLabel === "90 phút")!.props.onPress();
    tree = render();
    tree
      .find((e) => e.type === "TimeFields")!
      .props.onLocalChange("2098-02-05T15:00");
    render();
    render();
    assert.equal(calls.length, 1);
    assert.equal(calls[0]![0]!.minutes, "120");
    apply();
    assert.equal(calls.length, 2);
    assert.equal(calls[1]![0]!.minutes, "90");
    tree = render();
    tree.find((e) => e.type === "TimeFields")!.props.onMinutesChange("45");
    apply();
    assert.equal(calls.length, 2);
    tree = render();
    tree.find((e) => e.type === "TimeFields")!.props.onMinutesChange("60");
    render(true)
      .find((e) => e.type === "Button")!
      .props.onPress();
    assert.equal(calls.length, 2);
  } finally {
    delete local.cache[filename];
    contexts.reverse().forEach((c) => c.restore());
  }
});
