import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";

type Element = { type: unknown; props: Record<string, unknown> };
function nodes(value: unknown): Element[] {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value || typeof value !== "object" || !("props" in value)) return [];
  const node = value as Element;
  return [node, ...nodes(node.props.children)];
}
test("compact material rating keeps accessible five-star selection without changing the default review form", () => {
  const local = createRequire(
    new URL(
      "../src/features/community/components/review-stars.tsx",
      import.meta.url,
    ),
  );
  const filename = local.resolve("./review-stars.tsx");
  const jsx = (type: unknown, props: unknown) => ({ type, props });
  const contexts = Object.entries({
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "react-native": {
      View: "View",
      Text: "Text",
      Pressable: "Pressable",
      Platform: { OS: "web" },
      StyleSheet: { create: (value: unknown) => value },
    },
    "@/components/Icon": { Icon: "Icon" },
  }).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  const changes: number[] = [];
  try {
    delete local.cache[filename];
    const { ReviewRatingPicker } = local(filename);
    const props = {
      value: 3,
      onChange: (value: number) => changes.push(value),
    };
    const standard = nodes(ReviewRatingPicker(props));
    assert.ok(
      standard.some(
        (node) =>
          node.type === "Text" &&
          node.props.children === "Trải nghiệm của bạn thế nào?",
      ),
    );
    const compact = nodes(ReviewRatingPicker({ ...props, compact: true }));
    assert.equal(compact.filter((node) => node.type === "Text").length, 0);
    const choices = compact.filter(
      (node) => node.props.accessibilityRole === "radio",
    );
    assert.equal(choices.length, 5);
    assert.equal(choices[2]?.props["aria-checked"], true);
    (choices[4]!.props.onPress as () => void)();
    let prevented = false;
    (choices[1]!.props.onKeyDown as (event: unknown) => void)({
      nativeEvent: { key: " " },
      preventDefault: () => {
        prevented = true;
      },
    });
    assert.deepEqual(changes, [5, 2]);
    assert.equal(prevented, true);
    const disabled = nodes(
      ReviewRatingPicker({ ...props, compact: true, disabled: true }),
    ).filter((node) => node.props.accessibilityRole === "radio");
    assert.ok(disabled.every((node) => node.props.disabled));
    (disabled[0]!.props.onKeyDown as (event: unknown) => void)({
      nativeEvent: { key: " " },
      preventDefault: () => {},
    });
    assert.deepEqual(changes, [5, 2]);
  } finally {
    contexts.reverse().forEach((context) => context.restore());
    delete local.cache[filename];
  }
});
