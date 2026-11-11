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

test("photo picker cancels cleanly, ignores old-owner selections and shares one tap lock; default consumers stay unchanged", async () => {
  const local = createRequire(
    new URL("../src/components/server-file-picker.tsx", import.meta.url),
  );
  const filename = local.resolve("./server-file-picker.tsx");
  const jsx = (type: unknown, props: Record<string, unknown>) => ({
    type,
    props,
  });
  let choose: (value: unknown) => void = () => {};
  let picks = 0,
    uploads = 0,
    changes = 0,
    current = true;
  const stubs = {
    react: {
      useRef: (value: unknown) => ({ current: value }),
      useState: (value: unknown) => [value, () => {}],
    },
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "Fragment" },
    "react-native": {
      Text: "Text",
      View: "View",
      StyleSheet: { create: (value: unknown) => value },
    },
    "expo-document-picker": {
      getDocumentAsync: async () => ({ canceled: true }),
    },
    "expo-image-picker": {
      UIImagePickerPreferredAssetRepresentationMode: {
        Compatible: "compatible",
      },
      launchImageLibraryAsync: () => {
        picks++;
        return new Promise((resolve) => {
          choose = resolve;
        });
      },
    },
    "./Button": { Button: "Button" },
    "./Icon": { Icon: "Icon" },
    "./feature-page": { Copy: "Copy" },
    "./FormNotice": { FormNotice: "Notice" },
  };
  const mocks = Object.entries(stubs).map(([id, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(id)), { namedExports }),
  );
  try {
    delete local.cache[filename];
    const { ServerFilePicker } = local(
      filename,
    ) as typeof import("../src/components/server-file-picker");
    const busy: boolean[] = [];
    const props = {
      files: [],
      onChange: () => {
        changes++;
      },
      upload: async () => {
        uploads++;
        return { fileId: "file", state: "SCANNING" };
      },
      status: async () => ({ fileId: "file", state: "READY" }),
      isCurrent: () => current,
      onBusyChange: (value: boolean) => busy.push(value),
    };
    const photoButton = (tree: unknown) =>
      elements(tree).find(
        (element) =>
          element.type === "Button" && element.props.children === "Chọn ảnh",
      )!;
    assert.equal(photoButton(ServerFilePicker(props)), undefined);
    const press = photoButton(ServerFilePicker({ ...props, allowPhotos: true }))
      .props.onPress as () => void;
    press();
    press();
    assert.equal(picks, 1);
    assert.deepEqual(busy, [true]);
    current = false;
    choose({
      canceled: false,
      assets: [
        {
          uri: "file:///photo.jpg",
          width: 1,
          height: 1,
          mimeType: "image/jpeg",
          fileSize: 100,
        },
      ],
    });
    await new Promise(setImmediate);
    assert.equal(uploads, 0);
    assert.equal(changes, 0);
    current = true;
    const first = { fileId: "first", name: "first.png", state: "SCANNING" };
    const second = { fileId: "second", name: "second.png", state: "READY" };
    let remaining = [first, second];
    const removalProps = {
      ...props,
      files: remaining,
      compact: true,
      checkOnSubmit: true,
      onChange: (next: typeof remaining) => {
        remaining = next;
      },
    };
    const tree = elements(ServerFilePicker(removalProps));
    assert.equal(
      tree.some(
        (element) => element.props.children === "Kiểm tra trạng thái tệp",
      ),
      false,
    );
    assert.equal(
      tree.some((element) => element.props.children === "Bỏ các tệp đã chọn"),
      false,
    );
    (
      tree.find(
        (element) => element.props.accessibilityLabel === "Bỏ tệp first.png",
      )!.props.onPress as () => void
    )();
    assert.deepEqual(remaining, [second]);
    const locked = elements(
      ServerFilePicker({ ...removalProps, disabled: true }),
    ).find(
      (element) => element.props.accessibilityLabel === "Bỏ tệp second.png",
    )!;
    assert.equal(locked.props.disabled, true);
    (locked.props.onPress as () => void)();
    assert.deepEqual(remaining, [second]);
    assert.deepEqual(busy, [true], "No callback updates the old owner");
    current = true;
    busy.length = 0;
    (
      photoButton(ServerFilePicker({ ...props, allowPhotos: true })).props
        .onPress as () => void
    )();
    choose({ canceled: true, assets: null });
    await new Promise(setImmediate);
    assert.deepEqual(busy, [true, false]);
    assert.equal(uploads, 0);
    assert.equal(changes, 0);
  } finally {
    delete local.cache[filename];
    mocks.reverse().forEach((item) => item.restore());
  }
});
