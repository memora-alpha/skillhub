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

test("photos open an in-chat viewer with contain, close and download, and failed previews can retry", () => {
  const local = createRequire(
    new URL(
      "../src/features/messages/components/ChatImageCard.tsx",
      import.meta.url,
    ),
  );
  const filename = local.resolve("./ChatImageCard.tsx");
  let cursor = 0,
    retried = 0,
    downloaded = 0;
  const slots: unknown[] = [];
  const jsx = (type: unknown, props: unknown) => ({ type, props });
  const mocks = {
    "react/jsx-runtime": { jsx, jsxs: jsx },
    react: {
      useState: (initial: unknown) => {
        const index = cursor++;
        if (!(index in slots)) slots[index] = initial;
        return [
          slots[index],
          (value: unknown) => {
            slots[index] = value;
          },
        ];
      },
    },
    "react-native": {
      View: "View",
      Text: "Text",
      Pressable: "Pressable",
      Modal: "Modal",
      StyleSheet: { create: (styles: unknown) => styles },
    },
    "expo-image": { Image: "Image" },
    "@/components/Icon": { Icon: "Icon" },
    "@/components/Button": { Button: "Button" },
    "@/components/SafeArea": { SafeAreaView: "SafeArea" },
    "./ChatImageViewer": { ChatImageViewer: "Viewer" },
  };
  const contexts = Object.entries(mocks).map(([id, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(id)), { namedExports }),
  );
  try {
    delete local.cache[filename];
    const { ChatImageCard } = local(
      filename,
    ) as typeof import("../src/features/messages/components/ChatImageCard");
    const props = {
      filename: "photo.png",
      uri: "file:///photo.png",
      onDownload: () => downloaded++,
      onRetry: () => retried++,
    };
    const render = (overrides = {}) => {
      cursor = 0;
      return elements(ChatImageCard({ ...props, ...overrides }));
    };
    const press = (node: Element | undefined) =>
      (node!.props.onPress as () => void)();
    let tree = render();
    assert.ok(!tree.some((node) => node.type === "Viewer"));
    assert.equal(
      tree.find((node) => node.type === "Image")!.props.cachePolicy,
      "none",
    );
    const empty = render({ uri: undefined });
    assert.ok(
      empty.some((node) => node.props.children === "Ảnh không còn khả dụng."),
      "missing pixels without an active request must not claim to be loading",
    );
    assert.ok(
      render({ uri: undefined, loading: true }).some(
        (node) => node.props.children === "Đang tải ảnh…",
      ),
    );
    press(
      tree.find(
        (node) => node.props.accessibilityLabel === "Xem ảnh photo.png",
      ),
    );
    tree = render();
    assert.equal(
      tree.find((node) => node.type === "Viewer")!.props.uri,
      "file:///photo.png",
    );
    (
      tree.find((node) => node.type === "Viewer")!.props
        .onDownload as () => void
    )();
    assert.equal(downloaded, 1);
    assert.ok(
      render().some((node) => node.type === "Viewer"),
      "download keeps the image viewer open",
    );
    const downloadFailure = render({
      downloadError: "Không lưu được ảnh.",
    }).find((node) => node.type === "Viewer")!;
    assert.equal(downloadFailure.props.downloadError, "Không lưu được ảnh.");
    assert.equal(
      downloadFailure.props.uri,
      "file:///photo.png",
      "download failure must not replace the image with a preview error",
    );
    press(render().find((node) => node.type === "Pressable"));
    (
      render().find((node) => node.type === "Viewer")!.props
        .onClose as () => void
    )();
    assert.ok(!render().some((node) => node.type === "Viewer"));
    (
      render().find((node) => node.type === "Image")!.props
        .onError as () => void
    )();
    assert.ok(!render().some((node) => node.type === "Image"));
    tree = render({ uri: undefined, error: "Không đọc được ảnh." });
    press(tree.find((node) => node.props.children === "Thử tải lại ảnh"));
    assert.equal(retried, 1);
    assert.ok(
      render().some((node) => node.type === "Image"),
      "the same refreshed URL can render after a retry",
    );
    press(render().find((node) => node.type === "Pressable"));
    for (const [status, copy] of [
      ["pending", "Đang tải lên…"],
      ["review", "Ảnh cần kiểm tra thêm."],
      ["unavailable", "Ảnh không còn khả dụng."],
    ]) {
      tree = render({ status, error: "stale error", onRetry: () => retried++ });
      assert.ok(tree.some((node) => node.props.children === copy));
      assert.ok(
        !tree.some((node) =>
          ["Image", "Viewer", "Pressable", "Button"].includes(
            String(node.type),
          ),
        ),
        "restricted images cannot expose pixels, an old viewer, retry or download",
      );
    }
  } finally {
    delete local.cache[filename];
    contexts.reverse().forEach((context) => context.restore());
  }
});
