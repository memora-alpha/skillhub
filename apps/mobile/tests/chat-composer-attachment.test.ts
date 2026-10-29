import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import type { ReactElement } from "react";

type Element = { type: unknown; props: Record<string, unknown> };
function elements(tree: unknown): Element[] {
  if (Array.isArray(tree)) return tree.flatMap(elements);
  if (!tree || typeof tree !== "object" || !("props" in tree)) return [];
  const element = tree as Element;
  return [element, ...elements(element.props.children)];
}

test("composer sends an attachment without requiring a caption and blocks send while the file is not ready", () => {
  const local = createRequire(
    new URL(
      "../src/features/messages/components/ChatComposer.tsx",
      import.meta.url,
    ),
  );
  const filename = local.resolve("./ChatComposer.tsx");
  const jsx = (type: unknown, props: unknown) =>
    ({ type, props }) as ReactElement;
  const mocks = {
    "react/jsx-runtime": { jsx, jsxs: jsx },
    react: { useState: (value: unknown) => [value, () => {}] },
    "react-native": {
      Pressable: "Pressable",
      TextInput: "Input",
      View: "View",
      StyleSheet: { create: (value: unknown) => value },
    },
    "@/components/Icon": { Icon: "Icon" },
  };
  const contexts = Object.entries(mocks).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  try {
    delete local.cache[filename];
    const { ChatComposer } = local(
      filename,
    ) as typeof import("../src/features/messages/components/ChatComposer");
    const sent: string[] = [];
    let picked = 0;
    const render = (
      hasAttachment: boolean,
      sendDisabled = false,
      attachmentDisabled = false,
    ) =>
      elements(
        ChatComposer({
          value: "",
          onChange: () => {},
          onSend: (text) => sent.push(text),
          onAttach: () => {
            picked++;
          },
          hasAttachment,
          sendDisabled,
          attachmentDisabled,
          attachmentPreview: hasAttachment
            ? jsx("Attachment", { children: "Selected file" })
            : undefined,
        }),
      );
    const button = (tree: Element[], label: string) =>
      tree.find((item) => item.props.accessibilityLabel === label)!;
    assert.equal(button(render(false), "Gửi tin nhắn").props.disabled, true);
    const ready = render(true);
    assert.ok(
      ready.some((item) => item.type === "Attachment"),
      "selected file is rendered within the composer",
    );
    assert.equal(button(ready, "Gửi tin nhắn").props.disabled, false);
    (button(ready, "Gửi tin nhắn").props.onPress as () => void)();
    assert.deepEqual(sent, [""]);
    (button(ready, "Đính kèm tệp").props.onPress as () => void)();
    assert.equal(picked, 1);
    assert.equal(
      button(render(true, true), "Gửi tin nhắn").props.disabled,
      true,
    );
    assert.equal(
      button(render(true, false, true), "Đính kèm tệp").props.disabled,
      true,
    );
  } finally {
    delete local.cache[filename];
    for (const context of contexts.reverse()) context.restore();
  }
});
