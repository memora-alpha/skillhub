import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import { materialOwnerId, materialOtherId } from "./fixtures/materials-data";

type Node = {
  type: unknown;
  props: { children?: unknown; [key: string]: unknown };
};
function nodes(value: unknown): Node[] {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value || typeof value !== "object" || !("props" in value)) return [];
  const node = value as Node;
  return [
    node,
    ...nodes(node.props.children),
    ...nodes(node.props.stickyFooter),
  ];
}

test("review editor gates writes, preserves a stale draft, and retains uncertain create identity when checking", async () => {
  const local = createRequire(
    new URL(
      "../src/features/materials/components/material-review-editor.tsx",
      import.meta.url,
    ),
  );
  const file = local.resolve("./material-review-editor.tsx");
  let state: unknown[] = [],
    slot = 0,
    uncertain = false,
    writes = 0;
  const checks: (boolean | undefined)[] = [];
  let receipt: unknown;
  const contexts = Object.entries({
    react: {
      useState: (initial: unknown) => {
        const n = slot++;
        if (!(n in state))
          state[n] = typeof initial === "function" ? initial() : initial;
        return [
          state[n],
          (next: unknown) => {
            state[n] = next;
          },
        ];
      },
    },
    "react/jsx-runtime": {
      jsx: (type: unknown, props: unknown) => ({ type, props }),
      jsxs: (type: unknown, props: unknown) => ({ type, props }),
      Fragment: "Fragment",
    },
    "react-native": { Text: "Text", View: "View" },
    "@/components/Button": { Button: "Button" },
    "@/components/Input": { Input: "Input" },
    "@/components/FormNotice": { FormNotice: "FormNotice" },
    "@/components/feature-page": { FeaturePage: "FeaturePage" },
    "@/components/InfoModal": { InfoModal: "InfoModal" },
    "@/components/Icon": { Icon: "Icon" },
    "@/features/community": {
      ReviewRatingPicker: "RatingPicker",
      ReviewStars: "ReviewStars",
    },
    "@/features/connections": {
      useConnectionCommand: () => ({
        pending: false,
        uncertain,
        run: async () => {
          writes++;
          return receipt;
        },
        retry: async () => {},
      }),
    },
    "../hooks/use-materials": { useMaterialsApi: () => ({}) },
    "../utils/material-failure": { materialFailure: () => "Lỗi" },
    "./material-review.styles": { reviewStyles: {} },
  }).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  const current = {
    id: materialOtherId,
    materialId: materialOwnerId,
    rating: 3,
    comment: "Bản gốc",
    status: "VISIBLE",
    version: 1,
    createdAt: "2026-11-15T10:00:00Z",
    updatedAt: "2026-11-15T10:00:00Z",
    deletedAt: null,
  };
  try {
    delete local.cache[file];
    const { MaterialReviewEditor } = local(file);
    let done = 0;
    const render = (review: unknown = null, ready = true) => {
      slot = 0;
      return nodes(
        MaterialReviewEditor({
          materialId: materialOwnerId,
          current: review,
          ready,
          onDone: () => {
            done++;
          },
          reconcile: async (preserve?: boolean) => {
            checks.push(preserve);
          },
        }),
      );
    };
    const button = (tree: Node[], name: string) =>
      tree.find(
        (node) =>
          node.type === "Button" &&
          (node.props.children === name ||
            node.props.accessibilityLabel === name),
      )!;
    let tree = render(null, false);
    assert.equal(button(tree, "Gửi đánh giá").props.disabled, true);
    state = [];
    tree = render();
    assert.equal(
      tree.find((node) => node.type === "FeaturePage")!.props.backBehavior,
      "history",
    );
    assert.equal(tree.filter((node) => node.type === "RatingPicker").length, 1);
    assert.equal(button(tree, "Gửi đánh giá").props.disabled, true);
    (button(tree, "Hủy").props.onPress as () => void)();
    assert.equal(done, 1);
    state = [];
    tree = render(current);
    assert.ok(button(tree, "Về thư viện"));
    assert.equal(tree.filter((node) => node.type === "RatingPicker").length, 0);
    state = [];
    tree = render(null, false);
    assert.equal(button(tree, "Gửi đánh giá").props.disabled, true);
    await (button(tree, "Gửi đánh giá").props.onPress as () => Promise<void>)();
    assert.equal(writes, 0);
    state = [];
    tree = render(current);
    (button(tree, "Chỉnh sửa đánh giá").props.onPress as () => void)();
    tree = render(current);
    (
      tree.find((node) => node.type === "Input")!.props.onChangeText as (
        value: string,
      ) => void
    )("Bản nháp đang sửa");
    tree = render({ ...current, version: 2 });
    assert.equal(
      tree.find((node) => node.type === "Input")!.props.value,
      "Bản nháp đang sửa",
    );
    assert.equal(button(tree, "Lưu đánh giá").props.disabled, true);
    await (button(tree, "Lưu đánh giá").props.onPress as () => Promise<void>)();
    assert.equal(
      writes,
      0,
      "a draft cannot silently write against a freshly read version",
    );
    state = [];
    uncertain = false;
    tree = render();
    uncertain = true;
    tree = render();
    (button(tree, "Kiểm tra lại đánh giá").props.onPress as () => void)();
    assert.deepEqual(
      checks,
      [true],
      "a missing create result must retain the command's exact key/body",
    );
    assert.equal(button(tree, "Gửi đánh giá").props.disabled, true);
    assert.ok(button(tree, "Gửi lại cùng đánh giá"));
    state = [];
    uncertain = false;
    tree = render({ ...current, status: "HIDDEN" });
    assert.equal(button(tree, "Chỉnh sửa đánh giá"), undefined);
    assert.equal(button(tree, "Xóa đánh giá").props.disabled, false);
    state = [];
    receipt = { ...current, deletedAt: current.createdAt };
    tree = render();
    tree = render();
    (
      tree.find((node) => node.type === "RatingPicker")!.props.onChange as (
        rating: number,
      ) => void
    )(5);
    tree = render();
    (button(tree, "Gửi đánh giá").props.onPress as () => void)();
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(
      checks,
      [true, undefined],
      "an authoritative deleted replay resolves the old create instead of showing success",
    );
  } finally {
    contexts.reverse().forEach((context) => context.restore());
    delete local.cache[file];
  }
});
