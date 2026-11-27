import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";

test("native viewer enables pinch library and double tap on local media, with close/download and loading fallback", () => {
  const local = createRequire(
    new URL(
      "../src/features/messages/components/ChatImageViewer.native.tsx",
      import.meta.url,
    ),
  );
  const filename = local.resolve("./ChatImageViewer.native.tsx");
  let cursor = 0;
  let position = { top: 48, left: 0, right: 0 };
  let decodeError: string | undefined;
  const slots: unknown[] = [];
  const jsx = (type: unknown, props: unknown) => ({ type, props });
  const contexts = [
    mock.module(pathToFileURL(local.resolve("react/jsx-runtime")), {
      namedExports: { jsx, jsxs: jsx },
    }),
    mock.module(pathToFileURL(local.resolve("react")), {
      namedExports: {
        useRef: (value: unknown) => {
          const index = cursor++;
          return (slots[index] ??= { current: value });
        },
        useState: (initial: unknown) => {
          const index = cursor++;
          if (!(index in slots))
            slots[index] = typeof initial === "function" ? initial() : initial;
          return [slots[index], () => {}];
        },
        useCallback: (fn: unknown, deps: unknown[]) => {
          const index = cursor++;
          const previous = slots[index] as
            { fn: unknown; deps: unknown[] } | undefined;
          if (
            !previous ||
            !deps.every((dep, i) => Object.is(dep, previous.deps[i]))
          )
            slots[index] = { fn, deps };
          return (slots[index] as { fn: unknown }).fn;
        },
      },
    }),
    mock.module(pathToFileURL(local.resolve("react-native")), {
      namedExports: {
        View: "View",
        useWindowDimensions: () => ({ height: 800 }),
      },
    }),
    mock.module(
      pathToFileURL(local.resolve("@/components/use-safe-area-position")),
      { namedExports: { useSafeAreaPosition: () => position } },
    ),
    mock.module(pathToFileURL(local.resolve("react-native-image-viewing")), {
      defaultExport: "ZoomViewer",
    }),
    mock.module(
      pathToFileURL(local.resolve("../hooks/use-native-chat-image")),
      {
        namedExports: {
          useNativeChatImage: (uri: string | undefined, enabled: boolean) => ({
            ready: !!uri && enabled && !decodeError,
            error: decodeError,
          }),
        },
      },
    ),
    mock.module(pathToFileURL(local.resolve("./ChatImageViewerBase")), {
      namedExports: {
        ChatImageFeedback: "Feedback",
        ChatViewerToolbar: "Toolbar",
        chatViewerBackground: "#000000",
        chatViewerToolbarHeight: 84,
      },
    }),
  ];
  try {
    delete local.cache[filename];
    const { ChatImageViewer } = local(
      filename,
    ) as typeof import("../src/features/messages/components/ChatImageViewer.native");
    let closed = 0,
      downloaded = 0;
    const props = {
      filename: "photo.jpg",
      uri: "file:///authenticated-preview.webp",
      onClose: () => closed++,
      onDownload: () => downloaded++,
    };
    type Element = {
      type: unknown;
      props: Record<string, unknown>;
    };
    const render = (overrides = {}) => {
      cursor = 0;
      return ChatImageViewer({ ...props, ...overrides }) as unknown as Element;
    };
    const viewer = render();
    assert.equal(viewer.type, "ZoomViewer");
    assert.equal(viewer.props.doubleTapToZoomEnabled, true);
    assert.equal(viewer.props.swipeToCloseEnabled, true);
    assert.equal(viewer.props.backgroundColor, "#000000");
    assert.deepEqual(viewer.props.images, [
      { uri: props.uri, headers: {}, cache: "reload" },
    ]);
    (viewer.props.onRequestClose as () => void)();
    assert.equal(closed, 1);
    const header = (
      viewer.props.HeaderComponent as () => { props: typeof props }
    )();
    header.props.onDownload();
    assert.equal(downloaded, 1);
    position = { top: 0, left: 0, right: 0 };
    const loading = render({ uri: undefined, pending: true });
    assert.equal(
      loading.type,
      "ZoomViewer",
      "loading and decoded images use the same modal component",
    );
    assert.deepEqual(loading.props.images, []);
    assert.equal(
      loading.props.HeaderComponent,
      viewer.props.HeaderComponent,
      "download/loading rerenders do not remount the toolbar",
    );
    const stableHeader = (loading.props.HeaderComponent as () => Element)();
    assert.deepEqual(
      stableHeader.props.safeAreaPadding,
      { paddingTop: 48, paddingLeft: 0, paddingRight: 0 },
      "modal inset updates cannot shift the opening placement",
    );
    assert.equal(
      stableHeader.props.pending,
      true,
      "a stable header still reads current action state",
    );
    const readyAgain = render();
    assert.equal(
      readyAgain.props.HeaderComponent,
      loading.props.HeaderComponent,
    );
    const failed = render({ error: "Không đọc được ảnh." });
    assert.equal(failed.type, viewer.type);
    assert.deepEqual(failed.props.images, []);
    assert.ok((failed.props.FooterComponent as () => Element)());
    decodeError = "Không đọc được ảnh.";
    const brokenLocalFile = render();
    assert.deepEqual(brokenLocalFile.props.images, []);
    const body = (brokenLocalFile.props.FooterComponent as () => Element)();
    assert.equal(
      (body.props.children as Element).props.error,
      decodeError,
      "a native local-file failure reaches the retry feedback without replacing the modal",
    );
    assert.equal(
      brokenLocalFile.props.HeaderComponent,
      viewer.props.HeaderComponent,
    );
  } finally {
    delete local.cache[filename];
    contexts.reverse().forEach((context) => context.restore());
  }
});

test("viewer toolbar exposes icon actions, guards repeated downloads and keeps close/retry available on failure", () => {
  const local = createRequire(
    new URL(
      "../src/features/messages/components/ChatImageViewerBase.tsx",
      import.meta.url,
    ),
  );
  const filename = local.resolve("./ChatImageViewerBase.tsx");
  type Element = { type: unknown; props: Record<string, unknown> };
  const elements = (tree: unknown): Element[] => {
    if (Array.isArray(tree)) return tree.flatMap(elements);
    if (!tree || typeof tree !== "object" || !("props" in tree)) return [];
    const node = tree as Element;
    if (typeof node.type === "function") return elements(node.type(node.props));
    return [node, ...elements(node.props.children)];
  };
  const jsx = (type: unknown, props: unknown) => ({ type, props });
  const contexts = Object.entries({
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "react-native": {
      Modal: "Modal",
      View: "View",
      Text: "Text",
      Pressable: "Pressable",
      ActivityIndicator: "Spinner",
      StyleSheet: { create: (styles: unknown) => styles },
    },
    "expo-image": { Image: "Image" },
    "@/components/Icon": { Icon: "Icon" },
    "@/components/SafeArea": { SafeAreaView: "SafeArea" },
  }).map(([id, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(id)), { namedExports }),
  );
  try {
    delete local.cache[filename];
    const { ChatViewerToolbar, ChatImageViewerBase } = local(
      filename,
    ) as typeof import("../src/features/messages/components/ChatImageViewerBase");
    let closed = 0,
      downloaded = 0,
      retried = 0;
    const props = {
      filename: "photo.jpg",
      onClose: () => closed++,
      onDownload: () => downloaded++,
    };
    const toolbar = elements(ChatViewerToolbar(props));
    const close = toolbar.find(
      (node) => node.props.accessibilityLabel === "Đóng ảnh",
    )!;
    const download = toolbar.find(
      (node) => node.props.accessibilityLabel === "Tải ảnh",
    )!;
    assert.equal(close.type, "Pressable");
    assert.equal(download.type, "Pressable");
    assert.ok(
      toolbar.some(
        (node) => node.type === "Icon" && node.props.name === "close",
      ),
    );
    assert.ok(
      toolbar.some(
        (node) => node.type === "Icon" && node.props.name === "download",
      ),
    );
    (close.props.onPress as () => void)();
    (download.props.onPress as () => void)();
    assert.equal(closed, 1);
    assert.equal(downloaded, 1);
    const downloadFailure = elements(
      ChatViewerToolbar({ ...props, downloadError: "Không lưu được ảnh." }),
    );
    assert.ok(
      downloadFailure.some(
        (node) =>
          node.props.accessibilityRole === "alert" &&
          node.props.children === "Không lưu được ảnh.",
      ),
    );
    (
      downloadFailure.find(
        (node) => node.props.accessibilityLabel === "Thử tải xuống lại ảnh",
      )!.props.onPress as () => void
    )();
    assert.equal(
      downloaded,
      2,
      "retry download is actionable inside the still-open modal",
    );
    const busy = elements(ChatViewerToolbar({ ...props, pending: true }));
    const busyDownload = busy.find(
      (node) => node.props.accessibilityLabel === "Đang tải ảnh…",
    )!;
    assert.equal(busyDownload.props.disabled, true);
    assert.deepEqual(busyDownload.props.accessibilityState, {
      disabled: true,
      busy: true,
    });
    assert.ok(busy.some((node) => node.type === "Spinner"));
    (busyDownload.props.onPress as () => void)();
    assert.equal(downloaded, 2);
    assert.ok(
      !elements(ChatViewerToolbar({ ...props, onDownload: undefined })).some(
        (node) => node.props.accessibilityLabel === "Tải ảnh",
      ),
    );
    const failed = elements(
      ChatImageViewerBase({
        ...props,
        error: "Không tải được ảnh.",
        onRetry: () => retried++,
      }),
    );
    (
      failed.find(
        (node) => node.props.accessibilityLabel === "Thử tải lại ảnh",
      )!.props.onPress as () => void
    )();
    assert.equal(retried, 1);
    (
      failed.find((node) => node.type === "Modal")!.props
        .onRequestClose as () => void
    )();
    assert.equal(closed, 2);
  } finally {
    delete local.cache[filename];
    contexts.reverse().forEach((context) => context.restore());
  }
});
