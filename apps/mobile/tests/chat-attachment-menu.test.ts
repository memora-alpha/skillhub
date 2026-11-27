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

test("attachment menus route photos and files separately, close on selection/cancel and disable while choosing", () => {
  const local = createRequire(
    new URL(
      "../src/features/messages/components/ChatAttachmentMenu.tsx",
      import.meta.url,
    ),
  );
  const filename = local.resolve("./ChatAttachmentMenu.tsx");
  const nativeFilename = local.resolve("./ChatAttachmentMenu.native.tsx");
  let open = false;
  const jsx = (type: unknown, props: unknown) => ({ type, props });
  const mocks = {
    react: {
      useState: () => [
        open,
        (next: boolean) => {
          open = next;
        },
      ],
    },
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "Fragment" },
    "react-native": {
      View: "View",
      Text: "Text",
      Pressable: "Pressable",
      Modal: "Modal",
      StyleSheet: { create: (s: unknown) => s, absoluteFill: {} },
    },
    "@/components/Icon": { Icon: "Icon" },
    "@expo/ui/community/menu": { MenuView: "NativeMenu" },
  };
  const contexts = Object.entries(mocks).map(([id, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(id)), { namedExports }),
  );
  try {
    delete local.cache[filename];
    delete local.cache[nativeFilename];
    const { ChatAttachmentMenu } = local(
      filename,
    ) as typeof import("../src/features/messages/components/ChatAttachmentMenu");
    const { ChatAttachmentMenu: NativeMenu } = local(
      nativeFilename,
    ) as typeof import("../src/features/messages/components/ChatAttachmentMenu.native");
    const picked: string[] = [];
    const onSelect = (source: "photos" | "files" | "clipboard") =>
      picked.push(source);
    const render = (disabled = false) =>
      elements(ChatAttachmentMenu({ disabled, onSelect }));
    const button = (label: string) =>
      render().find((n) => n.props.accessibilityLabel === label)!;
    const visible = () =>
      render().find((n) => n.type === "Modal")!.props.visible;
    assert.equal(visible(), false);
    (button("Thêm ảnh hoặc tệp").props.onPress as () => void)();
    assert.equal(visible(), true);
    (button("Chọn ảnh").props.onPress as () => void)();
    assert.deepEqual(picked, ["photos"]);
    assert.equal(visible(), false);
    (button("Thêm ảnh hoặc tệp").props.onPress as () => void)();
    (button("Chọn tệp").props.onPress as () => void)();
    assert.deepEqual(picked, ["photos", "files"]);
    assert.equal(visible(), false);
    (button("Thêm ảnh hoặc tệp").props.onPress as () => void)();
    (button("Đóng menu đính kèm").props.onPress as () => void)();
    assert.equal(visible(), false);
    const disabled = render(true);
    const trigger = disabled.find(
      (n) => n.props.accessibilityLabel === "Thêm ảnh hoặc tệp",
    )!;
    assert.equal(trigger.props.disabled, true);
    (trigger.props.onPress as () => void)();
    assert.equal(visible(), false);
    const native = NativeMenu({ onSelect }) as unknown as Element;
    assert.equal(native.type, "NativeMenu");
    assert.deepEqual(
      (native.props.actions as { id: string; title: string }[]).map(
        ({ id, title }) => ({ id, title }),
      ),
      [
        { id: "photos", title: "Ảnh" },
        { id: "files", title: "Tệp" },
      ],
    );
    const choose = native.props.onPressAction as (e: {
      nativeEvent: { event: string };
    }) => void;
    choose({ nativeEvent: { event: "photos" } });
    choose({ nativeEvent: { event: "files" } });
    choose({ nativeEvent: { event: "unexpected" } });
    assert.deepEqual(picked, ["photos", "files", "photos", "files"]);
    choose({ nativeEvent: { event: "clipboard" } });
    assert.equal(picked.at(-1), "files");
    assert.ok(
      !render().some((node) => node.props.accessibilityLabel === "Dán ảnh"),
    );
    assert.equal(
      (NativeMenu({ disabled: true, onSelect }) as unknown as Element).type,
      "View",
    );
  } finally {
    delete local.cache[filename];
    delete local.cache[nativeFilename];
    contexts.reverse().forEach((context) => context.restore());
  }
});
