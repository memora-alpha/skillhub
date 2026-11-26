import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import type { PasteEventPayload } from "expo-paste-input";

type Element = { type: unknown; props: Record<string, unknown> };

test("native input uses system image paste without duplicating text, respects locks and falls back on older binaries", () => {
  const local = createRequire(
    new URL(
      "../src/features/messages/components/ChatPasteInput.native.tsx",
      import.meta.url,
    ),
  );
  const filename = local.resolve("./ChatPasteInput.native.tsx");
  const pasted: unknown[] = [];
  let available = true;
  const jsx = (type: unknown, props: unknown) => ({ type, props });
  const contexts = Object.entries({
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "react-native": { TextInput: "Input" },
    expo: {
      requireOptionalNativeModule: () => (available ? {} : null),
      requireNativeView: () => "Wrapper",
    },
  }).map(([id, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(id)), { namedExports }),
  );
  try {
    const load = () => {
      delete local.cache[filename];
      return local(
        filename,
      ) as typeof import("../src/features/messages/components/ChatPasteInput.native");
    };
    const { ChatPasteInput } = load();
    const props = {
      value: "caption",
      multiline: true,
      style: { flex: 1 },
      onPasteImage: (image: unknown) => pasted.push(image),
    };
    const tree = ChatPasteInput(props) as Element;
    assert.equal(tree.type, "Wrapper");
    const paste = (payload: PasteEventPayload) =>
      (tree.props.onPaste as (event: unknown) => void)({
        nativeEvent: payload,
      });
    paste({ type: "text", value: "text already inserted" });
    paste({ type: "unsupported" });
    assert.deepEqual(pasted, []);
    paste({ type: "images", uris: ["file:///a.png"] });
    assert.deepEqual(pasted, [{ uris: ["file:///a.png"] }]);
    for (const lock of [{ pasteDisabled: true }, { editable: false }]) {
      const node = ChatPasteInput({ ...props, ...lock }) as Element;
      (node.props.onPaste as (event: unknown) => void)({
        nativeEvent: { type: "images", uris: ["file:///ignored.png"] },
      });
    }
    assert.equal(pasted.length, 1);
    available = false;
    const fallback = load().ChatPasteInput(props) as Element;
    assert.equal(fallback.type, "Input");
    assert.equal(fallback.props.style, props.style);
    assert.equal(fallback.props.value, "caption");
  } finally {
    delete local.cache[filename];
    contexts.reverse().forEach((context) => context.restore());
  }
});

test("web editor leaves text paste to the browser, consumes images once and detaches its listener", async () => {
  const local = createRequire(
    new URL(
      "../src/features/messages/components/ChatPasteInput.web.tsx",
      import.meta.url,
    ),
  );
  const filename = local.resolve("./ChatPasteInput.web.tsx");
  let listener: ((event: unknown) => void) | undefined;
  const pasted: unknown[] = [];
  const cleanups: (() => void)[] = [];
  let prevented = 0;
  const element = {
    addEventListener: (_type: string, next: typeof listener) => {
      listener = next;
    },
    removeEventListener: (_type: string, old: typeof listener) => {
      if (listener === old) listener = undefined;
    },
  };
  const jsx = (type: unknown, props: unknown) => ({ type, props });
  const contexts = Object.entries({
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "react-native": { TextInput: "Input" },
    react: {
      useRef: () => ({ current: element }),
      useEffect: (effect: () => () => void) => cleanups.push(effect()),
    },
  }).map(([id, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(id)), { namedExports }),
  );
  try {
    delete local.cache[filename];
    const { ChatPasteInput } = local(
      filename,
    ) as typeof import("../src/features/messages/components/ChatPasteInput.web");
    const props = {
      value: "caption",
      onPasteImage: (image: unknown) => pasted.push(image),
    };
    ChatPasteInput(props);
    const event = (files: File[]) => ({
      clipboardData: { files },
      preventDefault: () => prevented++,
    });
    listener!(event([]));
    assert.equal(prevented, 0);
    assert.deepEqual(pasted, []);
    const photo = new File(["png bytes"], "photo.png", { type: "image/png" });
    listener!(event([photo]));
    assert.equal(prevented, 1);
    assert.deepEqual(pasted, [{ files: [photo] }]);
    cleanups.pop()!();
    assert.equal(listener, undefined);
    ChatPasteInput({ ...props, pasteDisabled: true });
    listener!(event([photo]));
    assert.equal(prevented, 2);
    assert.equal(pasted.length, 1);
    const { importPastedChatImage } = local(
      "../utils/import-pasted-chat-image.web.ts",
    ) as typeof import("../src/features/messages/utils/import-pasted-chat-image.web");
    const selected = await importPastedChatImage({ files: [photo] });
    assert.equal(selected.file, photo);
    assert.match(selected.uri, /^blob:/);
    selected.cleanup?.();
    await assert.rejects(
      importPastedChatImage({
        files: [new File(["gif"], "a.gif", { type: "image/gif" })],
      }),
      /JPG, PNG hoặc WebP/,
    );
  } finally {
    cleanups.forEach((cleanup) => cleanup());
    delete local.cache[filename];
    contexts.reverse().forEach((context) => context.restore());
  }
});
