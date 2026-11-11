import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";

test("compact support history reveals recent messages, expands older history and retains explicit pagination", () => {
  const local = createRequire(
    new URL(
      "../src/features/reports/components/case-message-history.tsx",
      import.meta.url,
    ),
  );
  const filename = local.resolve("./case-message-history.tsx");
  let expanded = false,
    loads = 0;
  const jsx = (type: unknown, props: unknown) => ({ type, props });
  const mocks = Object.entries({
    react: {
      useMemo: (fn: () => unknown) => fn(),
      useState: () => [
        expanded,
        (value: boolean) => {
          expanded = value;
        },
      ],
    },
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "react-native": {
      Text: "Text",
      View: "View",
      StyleSheet: { create: (v: unknown) => v },
    },
    "@/components/Button": { Button: "Button" },
  }).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  type Element = {
    type: string;
    props: { children?: unknown; onPress?: () => void };
  };
  const nodes = (tree: unknown): Element[] => {
    if (Array.isArray(tree)) return tree.flatMap(nodes);
    if (!tree || typeof tree !== "object" || !("props" in tree)) return [];
    const node = tree as Element;
    return [node, ...nodes(node.props.children)];
  };
  try {
    delete local.cache[filename];
    const { CaseMessageHistory } = local(filename);
    const messages = [5, 4, 3, 2, 1].map((value) => ({
      id: String(value),
      text: `message-${value}`,
      senderId: "staff",
      createdAt: `2030-01-01T0${value}:00:00Z`,
    }));
    const render = () =>
      nodes(
        CaseMessageHistory({
          messages,
          userId: "viewer",
          hasMore: true,
          loading: false,
          onLoadOlder: () => {
            loads++;
          },
        }),
      );
    const messageTexts = (tree: Element[]) =>
      tree
        .map((node) => node.props.children)
        .filter(
          (text) => typeof text === "string" && text.startsWith("message-"),
        );
    assert.deepEqual(messageTexts(render()), [
      "message-3",
      "message-4",
      "message-5",
    ]);
    render().find((node) => node.props.children === "Xem trao đổi trước")!.props
      .onPress!();
    assert.deepEqual(messageTexts(render()), [
      "message-1",
      "message-2",
      "message-3",
      "message-4",
      "message-5",
    ]);
    assert.equal(loads, 0);
    render().find((node) => node.props.children === "Tin nhắn trước")!.props
      .onPress!();
    assert.equal(loads, 1);
    render().find((node) => node.props.children === "Thu gọn trao đổi")!.props
      .onPress!();
    assert.deepEqual(messageTexts(render()), [
      "message-3",
      "message-4",
      "message-5",
    ]);
  } finally {
    delete local.cache[filename];
    mocks.forEach((item) => item.restore());
  }
});
